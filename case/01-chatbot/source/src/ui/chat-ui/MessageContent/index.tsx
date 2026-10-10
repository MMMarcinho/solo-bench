import { MessageChunkType, MessageContentType } from '@/typings';
import { stripMetaBlocks } from '@/utils/msg';
import type { ComponentProps, XMarkdownProps } from '@ant-design/x-markdown';
import { XMarkdown } from '@ant-design/x-markdown';
import { useSetState } from 'ahooks';
import cls from 'classnames';
import { ChevronDown, ChevronUp } from 'lucide-react';
import React from 'react';
import { CodeBlock } from '../CodeBlock';
import { Image } from '../Image';
import type { ITokenUsage } from '../TokenUsage';
import { TokenUsage } from '../TokenUsage';
import type { IToolCallConfig } from '../ToolCall';
import { ToolCall } from '../ToolCall';
import { CLASS_PREFIX } from '../constants';
import type { IToolCall } from '../typings/tool';
import './index.less';

const classPrefix = `${CLASS_PREFIX}-message-content`;
const MarkdownCodeBlock = CodeBlock as React.ComponentType<ComponentProps>;
const COLLAPSED_CONTENT_HEIGHT = 336;

type MessageContentMarkdownProps = Omit<XMarkdownProps, 'content' | 'children'>;

export type IMessageContentToolCall = IToolCall;
export type IMessageContentUsage = ITokenUsage;

export interface IMessageContentTextData {
  type: MessageContentType.Text;
  text: string;
  /**
   * 原始 chunk 类型，用于展示流式状态的特殊样式。
   */
  chunkType?: string;
}

export type IMessageContentToolUseData = {
  type: MessageContentType.ToolUse;
} & IMessageContentToolCall;

export type IMessageContentData =
  | IMessageContentTextData
  | IMessageContentToolUseData;

export interface IMessageContentProps {
  data: string | IMessageContentData[];
  isSendByMe: boolean;
  style?: React.CSSProperties;
  ignoreBackground?: boolean;
  /**
   * @ant-design/x-markdown 配置，用于 Markdown 与流式内容渲染。
   */
  markdownProps?: MessageContentMarkdownProps;
  /**
   * 流式渲染快捷配置。传入后优先级高于 markdownProps.streaming。
   */
  streaming?: XMarkdownProps['streaming'];
  /**
   * Token 消耗信息。
   */
  usage?: IMessageContentUsage;
  /**
   * ToolCall 配置透传(文案覆盖 / 工具识别规则 / codex 解析)。
   */
  config?: IToolCallConfig;
}

interface IRenderTextOptions {
  /**
   * 文本内容
   */
  content: string;
  /**
   * 是否启用流式 Markdown 渲染
   */
  enableStreaming: boolean;
  /**
   * 是否展示重连中的闪光效果
   */
  shimmer: boolean;
}

interface ICollapseState {
  /** 内容是否超出折叠高度。 */
  isOverflowing: boolean;
  /** 当前是否处于收起状态。 */
  isCollapsed: boolean;
}

interface IMarkdownLinkProps extends ComponentProps {
  /** Markdown 链接地址。 */
  href?: string;
}

interface IMarkdownImageProps
  extends Omit<ComponentProps, 'onError' | 'onLoad'> {
  /** 图片替代文本。 */
  alt?: string;
  /** 图片地址。 */
  src?: string;
  /** 图片加载失败回调。 */
  onError?: React.ReactEventHandler<HTMLImageElement>;
  /** 图片加载完成回调。 */
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
}

/**
 * 渲染 Markdown 超链接，避免项目内相对路径在消息中成为无效跳转入口。
 */
function MarkdownLink(props: IMarkdownLinkProps) {
  const {
    children,
    domNode: _domNode,
    href,
    streamStatus: _streamStatus,
    ...anchorProps
  } = props;

  // 消费 Markdown 渲染器注入的内部字段，避免透传至原生 a 标签。
  void _domNode;
  void _streamStatus;

  if (href?.startsWith('/')) {
    return <code>{children}</code>;
  }

  return (
    <a
      {...(anchorProps as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      href={href}
    >
      {children}
    </a>
  );
}

/**
 * 使用通用 Image 组件渲染支持渐进加载、失败重试和预览的 Markdown 图片。
 */
function MarkdownImage(props: IMarkdownImageProps) {
  const {
    alt,
    children: _children,
    className,
    dangerouslySetInnerHTML: _dangerouslySetInnerHTML,
    domNode: _domNode,
    onError,
    onLoad,
    src,
    style,
    streamStatus: _streamStatus,
    ...imageProps
  } = props;

  // img 是 void element，必须过滤 children、dangerouslySetInnerHTML 和 Markdown 内部字段。
  void _children;
  void _dangerouslySetInnerHTML;
  void _domNode;
  void _streamStatus;

  return (
    <Image
      {...(imageProps as React.ImgHTMLAttributes<HTMLImageElement>)}
      alt={alt ?? ''}
      className={typeof className === 'string' ? className : undefined}
      imageStyle={style as React.CSSProperties}
      src={src}
      onError={onError}
      onLoad={onLoad}
    />
  );
}

/**
 * 提取文本消息里的可复制文案，忽略工具调用等非文本内容。
 */
export function getCopyText(dataList: IMessageContentData[]) {
  return dataList
    .filter(
      (item): item is IMessageContentTextData =>
        item.type === MessageContentType.Text,
    )
    .map((item) => stripMetaBlocks(item.text))
    .filter(Boolean)
    .join('\n\n');
}

/**
 * 判断当前文本是否是重连中的错误提示。
 */
function isReconnectingErrorText(item: IMessageContentTextData): boolean {
  return (
    item?.chunkType === MessageChunkType.Error &&
    /^Reconnecting\.\.\./.test(item.text)
  );
}

export const MessageContent: React.FC<IMessageContentProps> = ({
  data,
  isSendByMe,
  style,
  ignoreBackground,
  markdownProps,
  streaming,
  usage,
  config,
}) => {
  const dataList = React.useMemo<IMessageContentData[]>(
    () =>
      typeof data === 'string'
        ? [
            {
              type: MessageContentType.Text,
              text: data,
            },
          ]
        : data,
    [data],
  );
  const components = React.useMemo(
    () => ({
      code: MarkdownCodeBlock,
      img: MarkdownImage,
      a: MarkdownLink,
      // 使用方最后覆盖默认渲染器，便于特殊消息复用完整 Markdown 能力。
      ...markdownProps?.components,
    }),
    [markdownProps?.components],
  );
  const lastTextIndex = React.useMemo(() => {
    for (let index = dataList.length - 1; index >= 0; index -= 1) {
      if (dataList[index]?.type === MessageContentType.Text) {
        return index;
      }
    }

    return -1;
  }, [dataList]);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const isOverflowingRef = React.useRef(false);
  const isCollapsedRef = React.useRef(true);
  const [collapseState, setCollapseState] = useSetState<ICollapseState>({
    isOverflowing: false,
    isCollapsed: true,
  });
  const shouldEnableCollapse =
    isSendByMe &&
    dataList.every((item) => item.type === MessageContentType.Text);

  /**
   * 根据实际渲染高度判断是否需要折叠，避免仅按字符数误判窄屏或 Markdown 内容。
   */
  function updateCollapseState() {
    const contentElement = contentRef.current;

    if (!shouldEnableCollapse || !contentElement) {
      isOverflowingRef.current = false;
      isCollapsedRef.current = false;
      setCollapseState((previousState) =>
        previousState.isOverflowing || previousState.isCollapsed
          ? { isOverflowing: false, isCollapsed: false }
          : null,
      );
      return;
    }

    const isOverflowing =
      contentElement.scrollHeight > COLLAPSED_CONTENT_HEIGHT;

    if (isOverflowing && !isOverflowingRef.current) {
      isCollapsedRef.current = true;
    }

    if (!isOverflowing) {
      isCollapsedRef.current = false;
    }

    isOverflowingRef.current = isOverflowing;
    setCollapseState((previousState) =>
      previousState.isOverflowing !== isOverflowing ||
      previousState.isCollapsed !== isCollapsedRef.current
        ? {
            isOverflowing,
            isCollapsed: isCollapsedRef.current,
          }
        : null,
    );
  }

  /**
   * 在浏览器绘制前判断初始折叠状态，并监听后续内容与容器宽度变化。
   */
  React.useLayoutEffect(() => {
    updateCollapseState();

    const contentElement = contentRef.current;
    if (!contentElement || typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(updateCollapseState);
    resizeObserver.observe(contentElement);

    if (contentElement.parentElement) {
      resizeObserver.observe(contentElement.parentElement);
    }

    return () => resizeObserver.disconnect();
  }, [dataList, shouldEnableCollapse]);

  /**
   * 切换用户消息的展开与收起状态。
   */
  function onToggleCollapse() {
    const isCollapsed = !isCollapsedRef.current;
    isCollapsedRef.current = isCollapsed;
    setCollapseState({ isCollapsed });
  }

  /**
   * 渲染文本 Markdown，并按状态追加对应样式。
   */
  function renderText(options: IRenderTextOptions) {
    const { content, enableStreaming, shimmer } = options;

    return (
      <XMarkdown
        {...markdownProps}
        components={components}
        content={stripMetaBlocks(content)}
        openLinksInNewTab={markdownProps?.openLinksInNewTab ?? true}
        streaming={
          enableStreaming ? streaming ?? markdownProps?.streaming : undefined
        }
        rootClassName={cls(
          `${classPrefix}__markdown`,
          shimmer && `${classPrefix}__markdown--reconnecting`,
          markdownProps?.rootClassName,
        )}
      />
    );
  }

  return (
    <section
      style={style}
      className={cls(
        `${classPrefix}`,
        {
          [`${classPrefix}--ignore`]: ignoreBackground,
        },
        !isSendByMe ? `${classPrefix}--left` : `${classPrefix}--right`,
      )}
    >
      <div
        ref={contentRef}
        className={cls(`${classPrefix}__collapse-content`, {
          [`${classPrefix}__collapse-content--collapsed`]:
            collapseState.isOverflowing && collapseState.isCollapsed,
        })}
      >
        {dataList?.map((item, index) => {
          if (item?.type === MessageContentType.ToolUse) {
            return (
              <ToolCall
                className={`${classPrefix}__tool-calls`}
                key={item.id || `${item.name || 'tool'}-${index}`}
                data={[item]}
                config={config}
              />
            );
          }

          return (
            <React.Fragment key={`text-${index}`}>
              {renderText({
                content: item.text,
                enableStreaming: index === lastTextIndex,
                shimmer: isReconnectingErrorText(item),
              })}
            </React.Fragment>
          );
        })}

        <TokenUsage className={`${classPrefix}__usage`} usage={usage} />
      </div>

      {!!collapseState?.isOverflowing && (
        <button
          type="button"
          className={`${classPrefix}__collapse-button`}
          aria-expanded={!collapseState.isCollapsed}
          aria-label={collapseState.isCollapsed ? '显示更多内容' : '收起内容'}
          onClick={onToggleCollapse}
        >
          <span>{collapseState.isCollapsed ? '显示更多' : '收起'}</span>
          {collapseState.isCollapsed ? <ChevronDown /> : <ChevronUp />}
        </button>
      )}
    </section>
  );
};
