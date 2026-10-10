import type { IScrollViewRef } from '@/primitives/ScrollView';
import React from 'react';
import { useStickToBottom } from 'use-stick-to-bottom';

interface IGetScrollRootOptions {
  /**
   * ScrollView 组件暴露的真实滚动节点。
   */
  scrollViewElement?: IScrollViewRef | null;
  /**
   * 列表底部占位元素，用于在 ref 不可用时向上查找滚动容器。
   */
  bottomElement?: HTMLDivElement | null;
}

interface IScrollPosition {
  /**
   * 记录时的滚动距离。
   */
  scrollTop: number;
  /**
   * 记录时内容区域的总高度。
   */
  scrollHeight: number;
  /**
   * 记录时首个可视消息组的锚点。
   */
  anchor?: IScrollAnchorPosition;
  /**
   * 加载完成后在参照消息上方额外露出的历史内容高度。
   */
  revealOffset: number;
}

interface IScrollAnchorPosition {
  /**
   * React 通过稳定 key 保留的消息节点。
   */
  element: HTMLDivElement;
  /**
   * 锚点相对滚动容器顶部的距离。
   */
  offsetTop: number;
}

interface IGetVisibleScrollAnchorOptions {
  /**
   * 实际负责滚动的容器。
   */
  scrollRoot: HTMLDivElement;
  /**
   * 包含全部消息节点的内容容器。
   */
  contentElement?: HTMLElement | null;
}

interface IRestoreScrollAnchorOptions {
  /**
   * 实际负责滚动的容器。
   */
  scrollRoot: HTMLDivElement;
  /**
   * 加载前记录的锚点。
   */
  anchor?: IScrollAnchorPosition;
  /**
   * 在参照消息上方额外露出的历史内容高度。
   */
  revealOffset: number;
}

interface IHasScrollableAncestorBeforeRootOptions {
  /**
   * 当前滚动事件的原始目标。
   */
  target: EventTarget | null;
  /**
   * 消息列表的滚动容器。
   */
  scrollRoot: HTMLDivElement;
}

export interface IUseAutoScrollToBottomResult {
  /**
   * 挂到 ScrollView 上，用于获取真实滚动节点。
   */
  scrollViewRef: React.RefObject<IScrollViewRef>;
  /**
   * ScrollView 内部实际负责滚动的 DOM 节点。
   */
  scrollRootRef: React.MutableRefObject<HTMLDivElement | null>;
  /**
   * 挂到列表底部占位元素，用于定位内容节点。
   */
  bottomRef: React.RefObject<HTMLDivElement>;
  /**
   * 加载历史消息前记录当前位置，供新消息插入列表头部后恢复。
   */
  captureScrollPosition: (revealOffset?: number) => void;
  /**
   * 标记下一次历史消息渲染后需要停留在顶部。
   */
  prepareScrollToTopAfterLoad: () => void;
  /**
   * 主动滚动到底部，并恢复后续消息的自动跟随。
   */
  forceScrollToBottom: () => void;
}

/**
 * 判断当前元素是否是纵向滚动容器。
 */
function isScrollableElement(element?: HTMLElement | null) {
  if (!element) {
    return false;
  }

  const style = window.getComputedStyle(element);

  return ['auto', 'scroll'].includes(style.overflowY);
}

/**
 * 获取 ScrollView 内部真正负责滚动的 DOM 节点。
 */
function getScrollRoot(options: IGetScrollRootOptions) {
  const { scrollViewElement, bottomElement } = options;

  if (scrollViewElement instanceof HTMLDivElement) {
    return scrollViewElement;
  }

  let currentElement = bottomElement?.parentElement;

  while (currentElement) {
    if (
      currentElement instanceof HTMLDivElement &&
      isScrollableElement(currentElement)
    ) {
      return currentElement;
    }

    currentElement = currentElement.parentElement;
  }

  return undefined;
}

/**
 * 获取当前视口内第一个消息组的稳定锚点和像素位置。
 */
function getVisibleScrollAnchor(
  options: IGetVisibleScrollAnchorOptions,
): IScrollAnchorPosition | undefined {
  const { scrollRoot, contentElement } = options;

  if (!contentElement) {
    return undefined;
  }

  const scrollRootRect = scrollRoot.getBoundingClientRect();
  const childElements = contentElement.children;

  for (let index = 0; index < childElements.length; index += 1) {
    const childElement = childElements[index];

    if (
      !(childElement instanceof HTMLDivElement) ||
      !childElement.classList.contains('scroll-item')
    ) {
      continue;
    }

    const scrollItemRect = childElement.getBoundingClientRect();
    const isVisible =
      scrollItemRect.bottom > scrollRootRect.top &&
      scrollItemRect.top < scrollRootRect.bottom;

    if (isVisible) {
      return {
        element: childElement,
        offsetTop: scrollItemRect.top - scrollRootRect.top,
      };
    }
  }

  return undefined;
}

/**
 * 根据加载前记录的消息锚点校准滚动位置，抵消组件后续的锚点恢复。
 */
function restoreScrollAnchor(options: IRestoreScrollAnchorOptions) {
  const { scrollRoot, anchor, revealOffset } = options;

  if (
    !anchor ||
    !anchor.element.isConnected ||
    !scrollRoot.contains(anchor.element)
  ) {
    return false;
  }

  const currentOffsetTop =
    anchor.element.getBoundingClientRect().top -
    scrollRoot.getBoundingClientRect().top;
  const scrollAdjustment = currentOffsetTop - (anchor.offsetTop + revealOffset);

  // 后续兜底校准通常无需移动，跳过无效写入以免额外触发滚动监听。
  if (Math.abs(scrollAdjustment) < 1) {
    return true;
  }

  scrollRoot.scrollTop += scrollAdjustment;
  return true;
}

/**
 * 在内容更新时自动贴底，并在加载历史消息后恢复原有视口。
 */
export function useAutoScrollToBottom(
  watchValues: React.DependencyList,
): IUseAutoScrollToBottomResult {
  const scrollViewRef = React.useRef<IScrollViewRef>(null);
  const scrollRootRef = React.useRef<HTMLDivElement | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  // 普通向上加载历史消息：先补偿新增高度，再按配置向上露出少量历史内容。
  const restoreScrollFrameRef = React.useRef<number>();
  // “下一帧回顶校准任务”的句柄
  const settleTopScrollFrameRef = React.useRef<number>();
  // “延迟回顶兜底任务”的句柄
  const settleTopScrollTimerRef = React.useRef<number>();
  // 普通历史加载完成后，下一帧再次校准可视消息锚点。
  const settleRestoreScrollFrameRef = React.useRef<number>();
  // 普通历史加载完成后，短延时兜底校准可视消息锚点。
  const settleRestoreScrollTimerRef = React.useRef<number>();
  const preservedScrollPositionRef = React.useRef<IScrollPosition>();
  const shouldScrollToTopAfterLoadRef = React.useRef(false);
  const scrollIntentCleanupRef = React.useRef<() => void>();
  const {
    scrollRef: stickScrollRef,
    contentRef: stickContentRef,
    scrollToBottom,
    stopScroll,
  } = useStickToBottom({
    initial: 'instant',
    resize: 'instant',
  });

  /**
   * 优先复用已确认的滚动容器，仅在节点失效或列表迁移后重新查找。
   */
  function resolveScrollRoot() {
    const cachedScrollRoot = scrollRootRef.current;
    const bottomElement = bottomRef.current;

    if (
      cachedScrollRoot?.isConnected &&
      (!bottomElement || cachedScrollRoot.contains(bottomElement))
    ) {
      return cachedScrollRoot;
    }

    return getScrollRoot({
      scrollViewElement: scrollViewRef.current,
      bottomElement,
    });
  }

  /**
   * 取消普通历史加载后尚未执行的锚点校准任务。
   */
  function cancelRestoreSettlement() {
    if (typeof settleRestoreScrollFrameRef.current === 'number') {
      window.cancelAnimationFrame(settleRestoreScrollFrameRef.current);
      settleRestoreScrollFrameRef.current = undefined;
    }

    if (typeof settleRestoreScrollTimerRef.current === 'number') {
      window.clearTimeout(settleRestoreScrollTimerRef.current);
      settleRestoreScrollTimerRef.current = undefined;
    }
  }

  /**
   * 移除旧滚动容器上的用户滚动意图监听，避免列表迁移后重复响应。
   */
  function cleanupScrollIntentListener() {
    scrollIntentCleanupRef.current?.();
    scrollIntentCleanupRef.current = undefined;
  }

  /**
   * 判断事件目标内是否存在仍可继续向上滚动的嵌套容器。
   */
  function hasScrollableAncestorBeforeRoot(
    options: IHasScrollableAncestorBeforeRootOptions,
  ) {
    const { target, scrollRoot } = options;
    let currentElement = target instanceof HTMLElement ? target : null;

    while (currentElement && currentElement !== scrollRoot) {
      const style = window.getComputedStyle(currentElement);
      const canScrollUp =
        ['auto', 'scroll'].includes(style.overflowY) &&
        currentElement.scrollHeight > currentElement.clientHeight &&
        currentElement.scrollTop > 0;

      if (canScrollUp) {
        return true;
      }

      currentElement = currentElement.parentElement;
    }

    return false;
  }

  /**
   * 监听用户主动向上滚动的意图，绕开第三方库对 overflow 简写值的误判。
   */
  function bindScrollIntentListener(scrollRoot: HTMLDivElement) {
    let previousTouchY: number | undefined;

    /**
     * 鼠标滚轮或触控板向上滚动时立即退出贴底状态。
     */
    function handleWheel(event: WheelEvent) {
      if (
        event.deltaY < 0 &&
        !hasScrollableAncestorBeforeRoot({
          target: event.target,
          scrollRoot,
        })
      ) {
        stopScroll();
      }
    }

    /**
     * 记录触摸起点，用于判断后续手势是否正在向上浏览历史消息。
     */
    function handleTouchStart(event: TouchEvent) {
      previousTouchY = event.touches[0]?.clientY;
    }

    /**
     * 手指向下移动代表列表内容向上滚动，此时立即退出贴底状态。
     */
    function handleTouchMove(event: TouchEvent) {
      const currentTouchY = event.touches[0]?.clientY;

      if (
        typeof previousTouchY === 'number' &&
        typeof currentTouchY === 'number' &&
        currentTouchY > previousTouchY &&
        !hasScrollableAncestorBeforeRoot({
          target: event.target,
          scrollRoot,
        })
      ) {
        stopScroll();
      }

      previousTouchY = currentTouchY;
    }

    scrollRoot.addEventListener('wheel', handleWheel, { passive: true });
    scrollRoot.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    scrollRoot.addEventListener('touchmove', handleTouchMove, {
      passive: true,
    });

    scrollIntentCleanupRef.current = () => {
      scrollRoot.removeEventListener('wheel', handleWheel);
      scrollRoot.removeEventListener('touchstart', handleTouchStart);
      scrollRoot.removeEventListener('touchmove', handleTouchMove);
    };
  }

  /**
   * 将 ScrollView 的真实节点接入成熟的贴底控制器。
   */
  function syncStickToBottomElements() {
    const scrollRoot = resolveScrollRoot();
    const contentElement = bottomRef.current?.parentElement || null;

    if (scrollRootRef.current !== scrollRoot) {
      cleanupScrollIntentListener();
      stickScrollRef(scrollRoot || null);
      scrollRootRef.current = scrollRoot || null;

      if (scrollRoot) {
        bindScrollIntentListener(scrollRoot);
      }
    }

    if (stickContentRef.current !== contentElement) {
      stickContentRef(contentElement);
    }
  }

  /**
   * 加载更早历史消息前记录当前位置，并暂停底部跟随。
   */
  function captureScrollPosition(revealOffset = 0) {
    const scrollRoot = resolveScrollRoot();

    if (!scrollRoot) {
      return;
    }

    cancelRestoreSettlement();
    stopScroll();
    preservedScrollPositionRef.current = {
      scrollTop: scrollRoot.scrollTop,
      scrollHeight: scrollRoot.scrollHeight,
      anchor: getVisibleScrollAnchor({
        scrollRoot,
        contentElement: bottomRef.current?.parentElement,
      }),
      revealOffset,
    };
  }

  /**
   * 标记由快捷回顶触发的历史加载，使新增历史后继续定位到顶部。
   */
  function prepareScrollToTopAfterLoad() {
    stopScroll();
    shouldScrollToTopAfterLoadRef.current = true;
  }

  /**
   * 将列表定位到顶部，用于覆盖 ScrollView 在列表项挂载后的锚点恢复。
   */
  function scrollToTop() {
    const scrollRoot = resolveScrollRoot();

    if (scrollRoot) {
      scrollRoot.scrollTop = 0;
    }
  }

  /**
   * 滚动到顶部，需要分页加载全量数据
   */
  function keepScrollAtTop() {
    scrollToTop();

    settleTopScrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollToTop();
      settleTopScrollFrameRef.current = undefined;
    });

    settleTopScrollTimerRef.current = window.setTimeout(() => {
      scrollToTop();
      settleTopScrollTimerRef.current = undefined;
    }, 80);
  }

  /**
   * 在历史消息渲染完成后补偿列表高度差，并按需露出少量新历史内容。
   */
  function restoreScrollPosition() {
    const preservedScrollPosition = preservedScrollPositionRef.current;

    if (!preservedScrollPosition && !shouldScrollToTopAfterLoadRef.current) {
      return;
    }

    if (typeof restoreScrollFrameRef.current === 'number') {
      window.cancelAnimationFrame(restoreScrollFrameRef.current);
    }

    restoreScrollFrameRef.current = window.requestAnimationFrame(() => {
      const scrollRoot = resolveScrollRoot();

      if (scrollRoot) {
        if (shouldScrollToTopAfterLoadRef.current) {
          keepScrollAtTop();
        } else if (preservedScrollPosition) {
          const hasRestoredAnchor = restoreScrollAnchor({
            scrollRoot,
            anchor: preservedScrollPosition.anchor,
            revealOffset: preservedScrollPosition.revealOffset,
          });

          // 消息节点被替换时，回退到内容高度差补偿，避免视口跳到列表顶部。
          if (!hasRestoredAnchor) {
            const scrollHeightDiff =
              scrollRoot.scrollHeight - preservedScrollPosition.scrollHeight;

            scrollRoot.scrollTop = Math.max(
              0,
              preservedScrollPosition.scrollTop +
                scrollHeightDiff -
                preservedScrollPosition.revealOffset,
            );
          }

          settleRestoreScrollFrameRef.current = window.requestAnimationFrame(
            () => {
              restoreScrollAnchor({
                scrollRoot,
                anchor: preservedScrollPosition.anchor,
                revealOffset: preservedScrollPosition.revealOffset,
              });
              settleRestoreScrollFrameRef.current = undefined;
            },
          );

          settleRestoreScrollTimerRef.current = window.setTimeout(() => {
            restoreScrollAnchor({
              scrollRoot,
              anchor: preservedScrollPosition.anchor,
              revealOffset: preservedScrollPosition.revealOffset,
            });
            settleRestoreScrollTimerRef.current = undefined;
          }, 80);
        }
      }

      preservedScrollPositionRef.current = undefined;
      shouldScrollToTopAfterLoadRef.current = false;
      restoreScrollFrameRef.current = undefined;
    });
  }

  /**
   * 主动发送消息时强制回到底部，并保持一小段时间以等待消息完成上屏。
   */
  function forceScrollToBottom() {
    void scrollToBottom({
      animation: 'instant',
      duration: 120,
      ignoreEscapes: true,
    });
  }

  const captureScrollPositionHandlerRef = React.useRef(captureScrollPosition);
  const prepareScrollToTopAfterLoadHandlerRef = React.useRef(
    prepareScrollToTopAfterLoad,
  );
  const forceScrollToBottomHandlerRef = React.useRef(forceScrollToBottom);
  const stableActionsRef =
    React.useRef<
      Pick<
        IUseAutoScrollToBottomResult,
        | 'captureScrollPosition'
        | 'prepareScrollToTopAfterLoad'
        | 'forceScrollToBottom'
      >
    >();

  captureScrollPositionHandlerRef.current = captureScrollPosition;
  prepareScrollToTopAfterLoadHandlerRef.current = prepareScrollToTopAfterLoad;
  forceScrollToBottomHandlerRef.current = forceScrollToBottom;

  if (!stableActionsRef.current) {
    stableActionsRef.current = {
      /**
       * 通过 ref 调用最新实现，避免消费方因函数引用变化重复执行副作用。
       */
      captureScrollPosition(revealOffset) {
        captureScrollPositionHandlerRef.current(revealOffset);
      },
      /**
       * 通过 ref 调用最新实现，并保持对外函数引用稳定。
       */
      prepareScrollToTopAfterLoad() {
        prepareScrollToTopAfterLoadHandlerRef.current();
      },
      /**
       * 通过 ref 调用最新实现，并保持命令式句柄稳定。
       */
      forceScrollToBottom() {
        forceScrollToBottomHandlerRef.current();
      },
    };
  }

  React.useLayoutEffect(() => {
    syncStickToBottomElements();
    restoreScrollPosition();
  }, watchValues);

  /**
   * 清理贴底控制器绑定的节点和等待中的视口恢复任务。
   */
  function cleanupAutoScroll() {
    if (typeof restoreScrollFrameRef.current === 'number') {
      window.cancelAnimationFrame(restoreScrollFrameRef.current);
    }

    if (typeof settleTopScrollFrameRef.current === 'number') {
      window.cancelAnimationFrame(settleTopScrollFrameRef.current);
    }

    if (typeof settleTopScrollTimerRef.current === 'number') {
      window.clearTimeout(settleTopScrollTimerRef.current);
    }

    cancelRestoreSettlement();
    cleanupScrollIntentListener();

    stickContentRef(null);
    stickScrollRef(null);
    scrollRootRef.current = null;
  }

  React.useEffect(() => {
    return cleanupAutoScroll;
  }, []);

  return {
    scrollViewRef,
    scrollRootRef,
    bottomRef,
    ...stableActionsRef.current,
  };
}
