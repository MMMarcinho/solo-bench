import { CLASS_PREFIX } from '@/constants';
import { useAutoScrollToBottom } from '@/hooks/useAutoScrollToBottom';
import { LoadingBar } from '@/LoadingBar';
import { MessageContent } from '@/MessageContent';
import { IMessageItem, IMessageRender, MessageItem } from '@/MessageItem';
import { TokenUsage } from '@/TokenUsage';
import { ToolCall } from '@/ToolCall';
import { MessageItemRole } from '@/typings';
import { getAvatarInitial } from '@/utils/msg';
import { Welcome } from '@/Welcome';
import { Avatar } from '@/primitives/Avatar';
import {
  ScrollViewProps,
  useScrollView,
} from '@/primitives/ScrollView';
import { LoadingOutlined } from 'antd-icons6';
import { useSetState } from 'ahooks';
import { FloatButton, Spin } from 'antd6';
import cls from 'classnames';
import { ArrowUp } from 'lucide-react';
import React from 'react';
import './index.less';
import {
  aggregateToolCallMessages,
  getMessageGroupId,
  isToolCallAggregated,
  mergeToolResultMessages,
  type IToolCallAggregated,
} from './utils';

const classPrefix = `${CLASS_PREFIX}-message-list`;
const messageItemClassPrefix = `${CLASS_PREFIX}-message-item`;

/**
 * 展示 AI 仍在持续输出的输入光标动画。
 */
function AiReplyTypingIndicator() {
  return (
    <span
      aria-label="AI 正在输入"
      className={`${classPrefix}__ai-reply-typing`}
      role="status"
    >
      <span
        aria-hidden="true"
        className={`${classPrefix}__ai-reply-typing-caret`}
      />
    </span>
  );
}

export interface IMessageListProps extends Partial<ScrollViewProps> {
  /**
   * @description 自定义类名
   */
  className?: string;
  /**
   * @description 自定义样式
   */
  style?: React.CSSProperties;
  /**
   * 渲染数据
   */
  data?: IMessageItem[];
  /**
   * Agent 头像 URL，assistant 角色消息使用；未传时使用 Agent 名称首字符头像。
   */
  agentAvatarUrl?: string;
  /**
   * 用户头像 URL；消息自身的 sender.avatarUrl 优先。
   */
  userAvatarUrl?: string;
  /**
   * Agent 名称，assistant 角色消息使用
   */
  agentName?: string;
  /**
   * 是否正在加载列表数据
   */
  loading?: boolean;
  /**
   * 收到 AI 回复 chunk 后，是否在最后一个 assistant 消息组底部展示加载状态
   */
  showAiTyping?: boolean;
  /**
   * 是否正在加载更早的历史消息
   */
  loadingMore?: boolean;
  /**
   * 自定义加载态内容
   */
  loadingElement?: React.ReactNode;
  /**
   * 自定义空态内容
   */
  emptyElement?: React.ReactNode;
  /**
   * 滚动到顶部时尝试加载更早的历史消息，返回是否已发起加载。
   */
  onLoadMore?: () => boolean;
  /**
   * 是否展示右下角的快捷回顶按钮，默认展示。
   */
  showBackTop?: boolean;
  /**
   * 普通向上加载完成后，在原可视内容上方额外露出的历史内容高度。
   */
  historyRevealOffset?: number;
}

export interface IMessageListRef {
  /**
   * 主动滚动到底部，并恢复后续消息的自动跟随。
   */
  scrollToBottom: () => void;
}

/**
 * MessageList 的固定渲染器，不依赖组件实例状态。
 */
const renders: IMessageRender[] = [
  // 文本消息
  (props, next) => {
    const nextRender = next?.(props);
    const { data, ext } = nextRender;
    const isSendByMe = !!ext?.isSendByMe;
    const isMessageContent =
      String(data?.role).toLowerCase() === MessageItemRole.User ||
      String(data?.role).toLowerCase() === MessageItemRole.Assistant ||
      !data?.role;

    if (
      isMessageContent &&
      ((Array.isArray(data?.content) && data?.content?.length) ||
        typeof data?.content === 'string')
    ) {
      return {
        ...nextRender,
        element: (
          <MessageContent
            data={data?.content}
            isSendByMe={isSendByMe}
            usage={data?.usage}
            streaming={data?.streaming}
          />
        ),
      };
    }

    return nextRender;
  },
  // loading
  (props, next) => {
    const nextRender = next?.(props);
    const { data } = nextRender;
    if (data?.loading) {
      return {
        ...nextRender,
        element: <LoadingBar startTimestamp={data?.timestamp} />,
      };
    }

    return nextRender;
  },
  // tool call 结果
  (props, next) => {
    const nextRender = next?.(props);
    const { data } = nextRender;

    // 聚合的工具调用
    if (isToolCallAggregated(data)) {
      return {
        ...nextRender,
        element: (
          <div className={`${classPrefix}__tool-call-content`}>
            <ToolCall data={data.toolCalls} />
            {/* 兼容 token usage 不单独 chunk 的情况 */}
            <TokenUsage
              className={`${classPrefix}__tool-call-usage`}
              usage={data.usage}
            />
          </div>
        ),
      };
    }

    if (data?.role === MessageItemRole.ToolResult) {
      return {
        ...nextRender,
        element: (
          <ToolCall
            data={[
              {
                id: data?.id || data?.msgId,
                name: data?.toolName || data?.name || 'unknown',
                startedAt: data?.startedAt,
                endedAt: data?.endedAt,
                input: data?.input || data?.arguments,
                output: data?.content,
              },
            ]}
          />
        ),
      };
    }

    return nextRender;
  },
];

type GroupData = {
  groupId: string;
  isUser: boolean;
  avatarUrl?: string;
  agentName?: string;
  senderName?: string;
  items: Array<{
    item: IMessageItem | IToolCallAggregated;
    index: number;
    key: string;
  }>;
};

interface IGetMessageItemKeyOptions {
  /** 当前需要渲染的消息项。 */
  item: IMessageItem | IToolCallAggregated;
  /** 消息在展示数据中的索引，用于没有标识的兜底场景。 */
  index: number;
  /** 已生成 key 的数量，用于为重复项追加序号。 */
  itemKeyCount: Record<string, number>;
}

interface IMessageListState {
  /** 消息内容超过一屏半时，才展示快捷回顶按钮。 */
  shouldShowBackTop: boolean;
}

/**
 * 生成消息展示项的唯一 key。
 *
 * 一条 assistant 消息会在工具调用聚合时被拆成多个展示项，此时它们保留相同 msgId。
 * 首项继续使用原始标识，后续重复项追加序号，避免 React 复用错误的节点。
 */
function getMessageItemKey(options: IGetMessageItemKeyOptions) {
  const { item, index, itemKeyCount } = options;
  const baseKey = isToolCallAggregated(item)
    ? `agg-${item.id || index}`
    : item?.msgId || item?.localMsgId || `${index}`;
  const duplicateCount = itemKeyCount[baseKey] || 0;

  itemKeyCount[baseKey] = duplicateCount + 1;

  return duplicateCount === 0 ? baseKey : `${baseKey}-${duplicateCount}`;
}

interface IReuseDisplayDataOptions {
  /** 上一次渲染使用的展示数据。 */
  previousData: Array<IMessageItem | IToolCallAggregated>;
  /** 本次重新计算得到的展示数据。 */
  nextData: Array<IMessageItem | IToolCallAggregated>;
}

/**
 * 判断两个聚合工具调用是否内容一致，以便复用历史项引用并命中 MessageItem 的 memo。
 */
function isSameToolCallAggregatedItem(
  previousItem: IToolCallAggregated,
  nextItem: IToolCallAggregated,
) {
  if (
    previousItem.id !== nextItem.id ||
    previousItem.timestamp !== nextItem.timestamp ||
    previousItem.streaming !== nextItem.streaming ||
    previousItem.usage !== nextItem.usage ||
    previousItem.toolCalls.length !== nextItem.toolCalls.length
  ) {
    return false;
  }

  return previousItem.toolCalls.every((previousToolCall, index) => {
    const nextToolCall = nextItem.toolCalls[index];

    return (
      previousToolCall.id === nextToolCall?.id &&
      previousToolCall.name === nextToolCall?.name &&
      previousToolCall.input === nextToolCall?.input &&
      previousToolCall.output === nextToolCall?.output &&
      previousToolCall.startedAt === nextToolCall?.startedAt &&
      previousToolCall.endedAt === nextToolCall?.endedAt &&
      previousToolCall.streaming === nextToolCall?.streaming
    );
  });
}

/**
 * 复用未变化的聚合工具调用对象，避免新消息触发历史 ToolCall 的重复渲染。
 */
function reuseDisplayData(options: IReuseDisplayDataOptions) {
  const { previousData, nextData } = options;

  return nextData.map((nextItem, index) => {
    const previousItem = previousData[index];

    if (
      isToolCallAggregated(previousItem) &&
      isToolCallAggregated(nextItem) &&
      isSameToolCallAggregatedItem(previousItem, nextItem)
    ) {
      return previousItem;
    }

    return nextItem;
  });
}

/**
 * 渲染消息列表，并在用户停留底部时跟随最新内容滚动。
 */
function InnerMessageList(
  props: IMessageListProps,
  ref: React.Ref<IMessageListRef>,
) {
  const {
    className,
    style,
    data,
    agentAvatarUrl,
    userAvatarUrl,
    agentName,
    loading,
    showAiTyping = false,
    loadingMore,
    loadingElement = (
      <Welcome
        avatarUrl={agentAvatarUrl}
        name={agentName}
        description={
          <div>
            <Spin
              style={{ marginRight: 6 }}
              size="small"
              indicator={<LoadingOutlined spin />}
            />{' '}
            对话消息加载中...
          </div>
        }
      />
    ),
    emptyElement = (
      <Welcome
        avatarUrl={agentAvatarUrl}
        name={agentName}
        description="尚未开始对话"
      />
    ),
    onScrollToTop,
    onLoadMore,
    showBackTop = true,
    scrollTopDistance = 50,
    historyRevealOffset = 50,
  } = props || {};
  const { ScrollView, ScrollItem } = useScrollView();
  const {
    scrollViewRef,
    scrollRootRef,
    bottomRef,
    captureScrollPosition,
    prepareScrollToTopAfterLoad,
    forceScrollToBottom,
  } = useAutoScrollToBottom([data, loading, showAiTyping]);
  const onScrollToTopRef = React.useRef(onScrollToTop);
  const onLoadMoreRef = React.useRef(onLoadMore);
  const captureScrollPositionRef = React.useRef(captureScrollPosition);
  const historyRevealOffsetRef = React.useRef(historyRevealOffset);
  const handleScrollToTopRef = React.useRef<() => boolean>();
  const shouldContinueLoadingToTopRef = React.useRef(false);
  const previousLoadingMoreRef = React.useRef(loadingMore);
  const shouldShowBackTopRef = React.useRef(false);
  const hasInitialScrolledRef = React.useRef(false);
  const displayDataRef = React.useRef<
    Array<IMessageItem | IToolCallAggregated>
  >([]);
  const [messageListState, setMessageListState] =
    useSetState<IMessageListState>({
      shouldShowBackTop: false,
    });

  React.useImperativeHandle(
    ref,
    () => ({
      scrollToBottom: forceScrollToBottom,
    }),
    [forceScrollToBottom],
  );

  onScrollToTopRef.current = onScrollToTop;
  onLoadMoreRef.current = onLoadMore;
  captureScrollPositionRef.current = captureScrollPosition;
  historyRevealOffsetRef.current = historyRevealOffset;

  if (!handleScrollToTopRef.current) {
    /**
     * 仅在确认已发起上一页加载时记录滚动位置，避免普通滚动误触发位置恢复。
     */
    handleScrollToTopRef.current = () => {
      if (onLoadMoreRef.current?.()) {
        captureScrollPositionRef.current(historyRevealOffsetRef.current);
        return true;
      }

      onScrollToTopRef.current?.();
      return false;
    };
  }

  /**
   * 记录快捷回顶意图，使历史消息每页加载完成后继续向更早的消息加载。
   */
  function handleBackTopClick() {
    shouldContinueLoadingToTopRef.current = true;
    prepareScrollToTopAfterLoad();
  }

  /**
   * 快捷回顶触发的上滑会在上一页加载期间被 loadingMore 拦截。
   * 页面加载完成后主动拉取下一页，直到 onLoadMore 明确返回 false。
   */
  React.useEffect(() => {
    const wasLoadingMore = previousLoadingMoreRef.current;
    previousLoadingMoreRef.current = loadingMore;

    if (
      !wasLoadingMore ||
      loadingMore ||
      !shouldContinueLoadingToTopRef.current
    ) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      prepareScrollToTopAfterLoad();

      if (!handleScrollToTopRef.current?.()) {
        shouldContinueLoadingToTopRef.current = false;
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [loadingMore, prepareScrollToTopAfterLoad]);

  /**
   * 工具调用合并和聚合会遍历整段消息，仅在消息数据变化时重新计算。
   */
  const displayData = React.useMemo(() => {
    const mergedData = mergeToolResultMessages(data);
    const nextDisplayData = aggregateToolCallMessages(mergedData);

    return reuseDisplayData({
      previousData: displayDataRef.current,
      nextData: nextDisplayData,
    });
  }, [data]);

  /**
   * 仅在提交后的副作用中更新缓存，避免并发渲染中断时污染下一次渲染的比较基准。
   */
  React.useEffect(() => {
    displayDataRef.current = displayData;
  }, [displayData]);
  const hasData = displayData.length > 0;

  /**
   * 首次会话加载完成且消息已经挂载后触发一次贴底，后续重新加载不打断用户阅读。
   */
  React.useEffect(() => {
    if (loading || !hasData || hasInitialScrolledRef.current) {
      return;
    }

    hasInitialScrolledRef.current = true;
    forceScrollToBottom();
  }, [forceScrollToBottom, hasData, loading]);

  /**
   * 内容或容器尺寸变化时，判断消息是否已超过一屏半。
   */
  React.useLayoutEffect(() => {
    const scrollRoot = scrollRootRef.current;
    const contentElement = bottomRef.current?.parentElement;

    if (!scrollRoot || !contentElement) {
      return undefined;
    }

    // 固化已判空的滚动容器引用，供内部回调安全使用。
    const scrollRootElement = scrollRoot;

    /** 同步回顶按钮的展示状态，避免重复更新相同状态。 */
    function updateBackTopVisibility() {
      const shouldShowBackTop =
        scrollRootElement.clientHeight > 0 &&
        scrollRootElement.scrollHeight >= scrollRootElement.clientHeight * 1.5;

      if (shouldShowBackTop === shouldShowBackTopRef.current) {
        return;
      }

      shouldShowBackTopRef.current = shouldShowBackTop;
      setMessageListState({ shouldShowBackTop });
    }

    updateBackTopVisibility();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(updateBackTopVisibility);
    resizeObserver.observe(scrollRootElement);
    resizeObserver.observe(contentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [bottomRef, hasData, loading, scrollRootRef, setMessageListState]);

  /**
   * 消息分组结果同样只在展示数据或 Agent 信息变化时重新创建。
   */
  const groups = React.useMemo(() => {
    const nextGroups: GroupData[] = [];
    const itemKeyCount: Record<string, number> = {};

    for (let i = 0; i < displayData.length; i++) {
      const item = displayData[i];
      const groupId = getMessageGroupId(item);
      const itemKey = getMessageItemKey({
        item,
        index: i,
        itemKeyCount,
      });
      const isUser = isToolCallAggregated(item)
        ? false
        : String(item?.role).toLowerCase() === MessageItemRole.User;
      const isCustom =
        !isToolCallAggregated(item) &&
        String(item?.role).toLowerCase() === MessageItemRole.Custom;

      if (isCustom) {
        // 自定义消息使用唯一的 solo ID，复用左侧布局但不与前后 assistant 聚合。
        nextGroups.push({
          groupId: `solo-custom-${itemKey}`,
          isUser: false,
          avatarUrl: agentAvatarUrl,
          agentName,
          items: [{ item, index: i, key: itemKey }],
        });
        continue;
      }

      if (isUser) {
        // 用户消息单独一组
        const { sender } = item as IMessageItem;
        const resolvedUserAvatarUrl = sender?.avatarUrl || userAvatarUrl;

        nextGroups.push({
          groupId: groupId || `solo-${i}`,
          isUser: true,
          avatarUrl: resolvedUserAvatarUrl,
          agentName,
          senderName: sender?.name,
          items: [{ item, index: i, key: itemKey }],
        });
      } else {
        // assistant 消息：同 groupId 合并，无 groupId 也跟前一个 assistant group 合并
        const lastGroup = nextGroups[nextGroups.length - 1];
        if (
          lastGroup &&
          !lastGroup.isUser &&
          (lastGroup.groupId === groupId ||
            (!groupId && !lastGroup.groupId?.startsWith('solo-')))
        ) {
          lastGroup.items.push({ item, index: i, key: itemKey });
          continue;
        }

        // 创建新 assistant group
        const sender = (item as IMessageItem)?.sender;
        nextGroups.push({
          groupId: groupId || `solo-${i}`,
          isUser: false,
          avatarUrl: agentAvatarUrl,
          agentName,
          senderName: sender?.name,
          items: [{ item, index: i, key: itemKey }],
        });
      }
    }

    return nextGroups;
  }, [agentAvatarUrl, userAvatarUrl, agentName, displayData]);

  return (
    <div className={cls(classPrefix, className)} style={style}>
      {loading ? (
        loadingElement
      ) : !hasData ? (
        emptyElement
      ) : (
        <ScrollView
          ref={scrollViewRef}
          onScrollToTop={handleScrollToTopRef.current}
          scrollTopDistance={scrollTopDistance}
        >
          {!!loadingMore && (
            <div
              className={`${classPrefix}__top-loading`}
              role="status"
              aria-live="polite"
            >
              <span className={`${classPrefix}__top-loading__icon`} />
              <span>加载中...</span>
            </div>
          )}

          {groups.map((group, groupIndex) => {
            // 组内首条消息 key 全局唯一，且不会因历史消息前插导致当前分组 key 整体变化。
            const groupKey = `group-${group?.items?.[0]?.key || groupIndex}`;
            const isReverse = group.isUser;
            const isCustomGroup =
              group.items.length === 1 &&
              !isToolCallAggregated(group.items[0].item) &&
              group.items[0].item?.role === MessageItemRole.Custom;
            /** 输入光标仅跟随最后一个 assistant 消息组，避免尚无 AI chunk 时提前展示。 */
            const shouldShowAiTyping =
              showAiTyping &&
              groupIndex === groups.length - 1 &&
              !group.isUser &&
              !isCustomGroup;

            // 判断每条消息是否是组内最后一条
            const isItemLastInGroup = (itemIdx: number) =>
              itemIdx === group.items.length - 1;

            return (
              <ScrollItem key={groupKey} id={groupKey}>
                <div
                  className={cls(
                    `${messageItemClassPrefix}__group`,
                    isReverse
                      ? `${messageItemClassPrefix}__group--right`
                      : `${messageItemClassPrefix}__group--left`,
                  )}
                >
                  {/* 头像列 */}
                  <div className={`${messageItemClassPrefix}__group__avatar`}>
                    {!group.avatarUrl ? (
                      <span
                        className={`${messageItemClassPrefix}__group__avatar__fallback`}
                        role="img"
                        aria-label={`${group.agentName || '机器人'}头像`}
                        title={group.agentName || '机器人'}
                      >
                        {getAvatarInitial(group.agentName)}
                      </span>
                    ) : (
                      <Avatar
                        src={group.avatarUrl}
                        className={`${messageItemClassPrefix}__group__avatar__img`}
                      />
                    )}
                    {group.isUser && group.senderName ? (
                      <span
                        className={`${messageItemClassPrefix}__group__avatar__name`}
                      >
                        {group.senderName || '我'}
                      </span>
                    ) : null}
                  </div>

                  {/* 消息列表列 */}
                  <div className={`${messageItemClassPrefix}__group__body`}>
                    {group?.items?.map(({ item, key }, itemIdx) => {
                      return (
                        <ScrollItem key={key} id={key}>
                          <MessageItem
                            data={item as IMessageItem}
                            renders={renders}
                            isSendByMe={group.isUser}
                            isSendOK={
                              isToolCallAggregated(item)
                                ? true
                                : (item as IMessageItem)?.isSendOK !== false
                            }
                            agentName={group.agentName}
                            footerElement={
                              shouldShowAiTyping &&
                              isItemLastInGroup(itemIdx) ? (
                                <AiReplyTypingIndicator />
                              ) : undefined
                            }
                            showHeader={itemIdx === 0}
                            showMeta={isItemLastInGroup(itemIdx)}
                          />
                        </ScrollItem>
                      );
                    })}
                  </div>
                </div>
              </ScrollItem>
            );
          })}

          <div ref={bottomRef} />
        </ScrollView>
      )}
      {!loading &&
      hasData &&
      showBackTop &&
      messageListState.shouldShowBackTop ? (
        <FloatButton.BackTop
          className={`${classPrefix}__back-top`}
          icon={<ArrowUp size={14} />}
          target={() => scrollRootRef.current!}
          onClick={handleBackTopClick}
          visibilityHeight={160}
          duration={200}
          aria-label="滚动到顶部"
          style={{
            position: 'absolute',
            right: '50%',
            bottom: 12,
            width: 32,
            minWidth: 32,
            height: 32,
            minHeight: 32,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
          }}
        />
      ) : null}
    </div>
  );
}

export const MessageList = React.forwardRef(InnerMessageList);

MessageList.displayName = 'MessageList';
