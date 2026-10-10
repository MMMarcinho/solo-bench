import { CLASS_PREFIX } from '@/constants';
import { Sender, type SenderProps } from '@ant-design/x';
import type {
  ActionsComponents,
  EventType,
  SlotConfigType,
} from '@ant-design/x/es/sender/interface';
import { useClickAway, useMemoizedFn, useSetState } from 'ahooks';
import { ConfigProvider, Flex, GetRef, Select } from 'antd6';
import cls from 'classnames';
import React, {
  forwardRef,
  memo,
  ReactNode,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  AttachmentProvider,
  AttachmentUploadActions,
  type IAttachmentController,
} from './components/AttachmentProvider';
import { ChatSenderHeader } from './components/ChatSenderHeader';
import {
  CommandPanel,
  type ICommandPanelRef,
  type ICommandSelectParams,
} from './components/CommandPanel';
import './index.less';
import type { IChatSenderUploadProps, IUploadFile } from './types';

const classPrefix = `${CLASS_PREFIX}-chat-sender`;
// 静态配置提升到组件外，避免受控输入每次变化时创建新的对象引用。
const DEFAULT_AUTO_SIZE = { minRows: 1, maxRows: 5 };
const MODEL_SELECT_CLASS_NAMES = {
  popup: {
    root: `${classPrefix}__model-popup`,
  },
};
const LOADING_BUTTON_THEME = {
  token: {
    colorPrimary: '#5865f2',
  },
};
const ACTION_BUTTON_STYLE = { borderRadius: 12 };

export interface ISuggestionItem {
  /** 快捷指令名称。 */
  label: ReactNode;
  /** 选中后回填的指令值。 */
  value: string;
  /** 指令右侧的补充说明。 */
  extra?: ReactNode;
}

export type SuggestionItems = ISuggestionItem[];

export interface IChatSenderSuggestionProps {
  /** 快捷指令列表，也支持按触发时机动态返回列表。 */
  items: SuggestionItems | (() => SuggestionItems);
  /** 以该字符开头会唤起快捷指令。 */
  supportChars?: string[];
  /** 输入触发字符时的回调。 */
  onTrigger?: (val: string) => void;
  /** 选中快捷指令时的回调。 */
  onSelect?: (value: string, items: SuggestionItems) => void;
  /** 受控的命令面板打开状态。 */
  open?: boolean;
  /** 命令面板打开状态变化回调。 */
  onOpenChange?: (open: boolean) => void;
}

export interface IChatSenderModelOption {
  label: ReactNode;
  value: string;
  disabled?: boolean;
}

export interface ISendMessageOptions {
  fileList?: Array<IUploadFile>;
  formData?: Record<string, any>;
  slotConfig?: SlotConfigType[];
  quote?: string;
  model?: string;
}

export type SendMessageType = (
  inputValue: string,
  opts?: ISendMessageOptions,
) => void;

export interface IChatSenderProps extends Omit<SenderProps, 'onSubmit'> {
  /**
   * @description 自定义类名
   */
  className?: string;
  /**
   * @description 自定义样式
   */
  style?: React.CSSProperties;
  /**
   * 发送消息给大模型。
   */
  onSend: SendMessageType;
  /**
   * 快捷指令。
   */
  suggestionProps?: IChatSenderSuggestionProps;
  /**
   * 附件上传。
   */
  uploadProps?: IChatSenderUploadProps;
  /**
   * 发送中状态。
   */
  loading?: boolean;
  /**
   * 取消发送回调。
   */
  onCancel?: () => void;
  /**
   * 文本引用删除回调。
   */
  onQuoteRemove?: (val: string) => void;
  /**
   * @description 可切换的模型列表，不传则不展示模型切换
   */
  modelOptions?: IChatSenderModelOption[];
  /**
   * @description 当前模型，受控模式
   */
  modelValue?: string;
  /**
   * @description 默认模型，非受控模式
   */
  defaultModelValue?: string;
  /**
   * @description 模型切换回调
   */
  onModelChange?: (value: string, option?: IChatSenderModelOption) => void;
  /**
   * @description 是否将上传、输入和发送操作展示在同一行
   */
  isSingleLineAction?: boolean;
}

export interface IChatSenderRef {
  addQuote: (quote: string) => void;
}

/**
 * 提供消息输入、附件上传、引用、模型选择和快捷指令能力。
 */
function InnerChatSender(
  props: IChatSenderProps,
  ref: React.Ref<IChatSenderRef>,
) {
  const {
    className,
    style,
    loading,
    suggestionProps,
    uploadProps,
    onSend,
    isSingleLineAction = true,
    modelOptions,
    modelValue,
    defaultModelValue,
    onModelChange,
    autoSize,
    prefix,
    footer,
    suffix,
    ...rest
  } = props;
  const [state, setState] = useSetState({
    // 引用和非受控模型需要触发视图更新，因此保存在 React 状态中。
    quote: '',
    modelValue: modelValue ?? defaultModelValue,
    // 仅在 suggestionProps.open 未传入时作为命令面板的内部状态。
    commandPanelOpen: false,
  });
  // Sender Ref 用于提交后清理非受控输入内容。
  const senderRef = useRef<GetRef<typeof Sender>>(null);
  // 根节点同时作为点击外部判断和默认拖拽容器。
  const senderContainerRef = useRef<HTMLDivElement>(null);
  // 附件状态由子组件隔离管理，顶层通过命令接口按需读取，避免订阅上传进度。
  const attachmentControllerRef = useRef<IAttachmentController>(null);
  // 快捷指令的选中索引在子组件管理，键盘事件通过命令接口转交。
  const commandPanelRef = useRef<ICommandPanelRef>(null);
  // 词槽内容只在提交时使用，无需放进状态触发渲染。
  const slotConfigRef = useRef<SlotConfigType[] | undefined>(undefined);
  // 模型取值优先级：受控值 > 内部选择值 > 默认值 > 第一项。
  const currentModel =
    modelValue ??
    state.modelValue ??
    defaultModelValue ??
    modelOptions?.[0]?.value;
  // 发送中也禁止新增附件，避免请求期间再次改变本次会话的附件集合。
  const isSenderDisabled = Boolean(loading || props.disabled);
  const sendDisabled = (() => {
    // 词槽模式允许文本为空，由词槽内容决定是否具备可提交数据。
    if ((rest.slotConfig || []).length > 0) {
      return false;
    }
    // 受控文本模式可直接根据 value 判断；非受控模式返回 undefined，
    // 继续使用 Sender 内部的默认禁用判断。
    if (rest.onChange) {
      return !rest.value?.length;
    }
    return undefined;
  })();
  const { supportChars, onTrigger: onSuggestionTrigger } =
    suggestionProps || {};
  const hasSuggestion = Boolean(supportChars?.length);
  // 外部传入 open 时完全受控，否则回退到组件内部状态。
  const isCommandPanelOpen = suggestionProps?.open ?? state.commandPanelOpen;

  /**
   * 获取当前输入命中的指令触发字符。
   */
  function getSuggestionSupportChar(inputValue: string) {
    return supportChars?.find((char) => inputValue.startsWith(char));
  }

  /**
   * 更新命令面板开关，并兼容外部受控状态。
   * 使用稳定函数引用，避免受控输入变化时穿透 CommandPanel.memo。
   */
  const updateCommandPanelOpen = useMemoizedFn((open: boolean) => {
    if (suggestionProps?.open === undefined) {
      setState({ commandPanelOpen: open });
    }
    suggestionProps?.onOpenChange?.(open);
  });

  /**
   * 选中快捷指令后透传当前条目。
   */
  const handleCommandSelect = useMemoizedFn((params: ICommandSelectParams) => {
    suggestionProps?.onSelect?.(params.value, params.items);
  });

  /**
   * 删除引用并通知调用方。
   */
  const handleQuoteRemove = useMemoizedFn((quote: string) => {
    setState({ quote: '' });
    props.onQuoteRemove?.(quote);
  });

  /**
   * 点击输入区和命令面板以外位置时关闭面板。
   */
  useClickAway(() => {
    if (isCommandPanelOpen) {
      updateCommandPanelOpen(false);
    }
  }, senderContainerRef);

  /**
   * 向外暴露添加引用能力。
   */
  useImperativeHandle(ref, () => ({
    addQuote(quote: string) {
      setState({ quote });
    },
  }));

  /**
   * 渲染模型选择器。
   */
  function renderModelSelect() {
    if (!modelOptions?.length) {
      return null;
    }

    return (
      <Select
        size="small"
        variant="borderless"
        className={`${classPrefix}__model-select`}
        classNames={MODEL_SELECT_CLASS_NAMES}
        value={currentModel}
        options={modelOptions}
        popupMatchSelectWidth={false}
        onChange={(nextModel, option) => {
          // 受控模式只通知调用方，非受控模式才更新内部模型值。
          if (modelValue === undefined) {
            setState({ modelValue: nextModel });
          }
          onModelChange?.(nextModel, option as IChatSenderModelOption);
        }}
      />
    );
  }

  /**
   * 渲染上传入口；文件状态由独立 Provider 管理。
   */
  function renderUploadActions() {
    return (
      <AttachmentUploadActions
        prefix={uploadProps?.prefix}
        suffix={uploadProps?.suffix}
      />
    );
  }

  /**
   * 渲染模型选择与发送/停止按钮。
   */
  function renderSenderActions(components?: ActionsComponents) {
    // 按钮组件由 Sender 的渲染插槽注入，避免在外部重复实现提交行为。
    const { SendButton, LoadingButton } = components || {};
    if (!SendButton || !LoadingButton) {
      return null;
    }

    return (
      <Flex
        gap="small"
        align="center"
        className={`${classPrefix}__button-group`}
      >
        {renderModelSelect()}
        {loading ? (
          <ConfigProvider theme={LOADING_BUTTON_THEME}>
            <LoadingButton
              type="default"
              shape="default"
              className={`${classPrefix}__loading-button`}
              style={ACTION_BUTTON_STYLE}
            />
          </ConfigProvider>
        ) : (
          <SendButton
            style={ACTION_BUTTON_STYLE}
            className={`${classPrefix}__send-button`}
            disabled={sendDisabled || props.disabled}
          />
        )}
      </Flex>
    );
  }

  /**
   * 渲染多行模式的默认底部区域。
   */
  // @ts-ignore
  const defaultFooter = (_, { components }) => (
    <Flex justify="space-between" align="center">
      {renderUploadActions()}
      {renderSenderActions(components)}
    </Flex>
  );

  /**
   * 渲染行内操作模式的右侧操作区。
   */
  // @ts-ignore
  const inlineSuffix = (_, { components }) => renderSenderActions(components);

  // 调用方显式传入的 autoSize 优先；默认随内容增长，超过五行后内部滚动。
  const mergedAutoSize = autoSize !== undefined ? autoSize : DEFAULT_AUTO_SIZE;
  // 行内操作模式把上传入口放在 prefix，调用方自定义 prefix 时不再覆盖。
  const mergedPrefix =
    isSingleLineAction && prefix === undefined ? renderUploadActions() : prefix;
  // 非行内操作模式使用底部操作栏；行内操作模式关闭 footer，避免重复展示操作按钮。
  const mergedFooter =
    footer !== undefined ? footer : isSingleLineAction ? false : defaultFooter;
  // 行内操作模式把发送操作放在 suffix；否则发送操作位于 footer。
  const mergedSuffix =
    isSingleLineAction && suffix === undefined ? inlineSuffix : false;

  /**
   * 同步输入值，并按触发字符控制快捷指令面板。
   */
  function onSenderChange(
    nextValue: string,
    event?: EventType,
    slotConfig?: SlotConfigType[],
  ) {
    const supportChar = getSuggestionSupportChar(nextValue);
    if (hasSuggestion) {
      const shouldOpenCommandPanel = Boolean(supportChar);
      // 仅在开关确实变化时更新，避免每次输入都触发额外状态渲染。
      if (isCommandPanelOpen !== shouldOpenCommandPanel) {
        updateCommandPanelOpen(shouldOpenCommandPanel);
      }
      // 输入内容变化后从第一条指令重新开始，防止旧索引越界或语义错位。
      commandPanelRef.current?.resetActiveIndex();
      // 只在首次输入触发字符时通知，不在后续普通字符输入时重复触发。
      if (supportChar && nextValue === supportChar) {
        onSuggestionTrigger?.(nextValue);
      }
    }

    // @ts-ignore
    rest.onChange?.(nextValue, event, slotConfig);
    // 词槽配置变化频繁但不参与当前渲染，只保存最后一次结果供提交读取。
    slotConfigRef.current = slotConfig;
  }

  /**
   * 输入框重新聚焦且仍保留触发字符时恢复命令面板。
   */
  function onSenderFocus(event: React.FocusEvent<HTMLTextAreaElement>) {
    if (hasSuggestion && getSuggestionSupportChar(event.currentTarget.value)) {
      updateCommandPanelOpen(true);
    }
    rest.onFocus?.(event);
  }

  /**
   * 等待输入框完成换行和高度更新，再让新增内容保持在可视区域。
   */
  function scrollInputToLatestLine(inputElement: HTMLElement) {
    window.requestAnimationFrame(() => {
      inputElement.scrollTop = inputElement.scrollHeight;
    });
  }

  /**
   * 处理输入框快捷键，让换行组合键优先保留原生行为。
   */
  function onSenderKeyDown(event: React.KeyboardEvent) {
    const isEnter = event.key === 'Enter';
    // 浏览器不会自动处理 Command / Control + Enter，需要主动在光标处插入换行。
    if (isEnter && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      rest.onKeyDown?.(event);
      const sender = senderRef.current;
      const inputElement = sender?.inputElement;
      if (inputElement instanceof HTMLTextAreaElement) {
        (sender?.insert as (value: string, position?: 'cursor') => void)?.(
          '\n',
          'cursor',
        );
      } else {
        (
          sender?.insert as (
            value: SlotConfigType[],
            position?: 'cursor',
          ) => void
        )?.([{ type: 'text', value: '\n' }], 'cursor');
      }
      if (inputElement) {
        scrollInputToLatestLine(inputElement);
      }
      return false;
    }

    // Shift + Enter 使用浏览器原生换行，只阻止 Sender 和快捷指令面板继续处理。
    if (isEnter && event.shiftKey) {
      rest.onKeyDown?.(event);
      return false;
    }

    // 面板打开时，方向键、Enter 和 Esc 必须优先由面板消费。
    if (commandPanelRef.current?.handleKeyDown(event)) {
      return false;
    }
    return rest.onKeyDown?.(event);
  }

  /**
   * 将粘贴的文件交给独立附件组件。
   */
  function handlePasteFile(files: FileList) {
    attachmentControllerRef.current?.uploadFiles(files);
  }

  /**
   * 提交消息并同步清空附件、引用和输入内容。
   */
  function handleSubmit(message: string) {
    // 发送中禁止重复提交；仅有触发字符时也不能作为普通消息发出。
    if (loading || supportChars?.includes(message)) {
      return;
    }

    // 附件列表在提交瞬间按需读取，上传进度变化不会带动 ChatSender 重渲染。
    onSend(message, {
      fileList: attachmentControllerRef.current?.getFileList(),
      slotConfig: slotConfigRef.current,
      quote: state.quote,
      model: currentModel,
    });
    // onSend 先接收完整快照，再释放附件预览与上传资源。
    attachmentControllerRef.current?.clear();
    setState({ quote: '' });
    // 受控输入通过 onChange 通知调用方清空。
    props.onChange?.('');
    // 非受控且非词槽模式由 Sender Ref 清空；词槽模式保留其内部清理逻辑。
    if (!rest.slotConfig?.length) {
      senderRef.current?.clear?.();
    }
  }

  return (
    <div
      ref={senderContainerRef}
      className={cls(classPrefix, className, {
        [`${classPrefix}--single-line-action`]: isSingleLineAction,
      })}
      style={style}
    >
      <AttachmentProvider
        ref={attachmentControllerRef}
        disabled={isSenderDisabled}
        uploadProps={uploadProps}
        senderContainerRef={senderContainerRef}
      >
        {/* 附件 Provider 包裹 Sender，使附件进度只通知对应 Context 消费组件。 */}
        <CommandPanel
          ref={commandPanelRef}
          items={suggestionProps?.items}
          open={hasSuggestion && isCommandPanelOpen}
          onOpenChange={updateCommandPanelOpen}
          onSelect={handleCommandSelect}
        />
        {/* 调用方属性先透传，后面的内部事件处理会覆盖关键行为并负责回调透传。 */}
        <Sender
          ref={senderRef}
          autoSize={mergedAutoSize}
          placeholder="请输入..."
          header={
            <ChatSenderHeader
              quote={state.quote}
              onQuoteRemove={handleQuoteRemove}
            />
          }
          prefix={mergedPrefix}
          footer={mergedFooter}
          loading={loading}
          {...rest}
          onChange={onSenderChange}
          onFocus={onSenderFocus}
          onKeyDown={onSenderKeyDown}
          onPasteFile={handlePasteFile}
          onSubmit={handleSubmit}
          suffix={mergedSuffix}
        />
      </AttachmentProvider>
    </div>
  );
}

// 父组件流式更新时，只要传入属性引用稳定，就跳过 ChatSender 的无关渲染。
export const ChatSender = memo(forwardRef(InnerChatSender));

export type { IChatSenderUploadProps, IUploadFile } from './types';
