import cls from 'classnames';
import React from 'react';

export interface ScrollViewProps {
  className?: string;
  id?: string;
  defaultAnchorId?: string | number;
  onScrollToTop?: () => void;
  onScrollToBottom?: () => void;
  children: React.ReactNode;
  visible?: boolean;
  scrolling?: boolean;
  scrollTopDistance?: number;
  scrollBottomDistance?: number;
}

export type ScrollState = {
  scrollTop?: number;
  contentHeight?: number;
  containerHeight?: number;
  stickyOffset?: number;
  stickyId?: string;
  scrollTopDiff?: number;
};

export interface IScrollViewRef extends HTMLDivElement {
  getScrollState: () => ScrollState;
  getScrollItem: (id?: string | number) => HTMLDivElement | null;
  getIsAtBottom: (distance?: number) => boolean;
  scrollToBottom: (options?: {
    smooth?: boolean;
    id?: string | number;
  }) => void;
}

interface ScrollItemProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'id'> {
  id: string | number;
}

const SCROLL_VIEW_STYLE: React.CSSProperties = {
  position: 'relative',
  overflowY: 'scroll',
  height: '100%',
};

const ScrollView = React.forwardRef<IScrollViewRef, ScrollViewProps>(
  function ScrollView(
    {
      className,
      id = 'scrollView',
      defaultAnchorId,
      children,
      onScrollToTop,
      onScrollToBottom,
      visible,
      scrolling,
      scrollTopDistance = 200,
      scrollBottomDistance = 100,
    },
    ref,
  ) {
    const scrollableRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const scrollStateRef = React.useRef<ScrollState>({});
    const topCallbackTimeRef = React.useRef(0);
    const bottomCallbackTimeRef = React.useRef(0);

    const getScrollItem = React.useCallback((anchorId?: string | number) => {
      if (anchorId === undefined || anchorId === null) return null;
      return (
        contentRef.current?.querySelector<HTMLDivElement>(
          `div[data-scroll-anchor="${CSS.escape(String(anchorId))}"]`,
        ) ?? null
      );
    }, []);

    const scrollToBottom = React.useCallback(
      (options?: { smooth?: boolean; id?: string | number }) => {
        const scrollable = scrollableRef.current;
        if (!scrollable) return;

        const item = getScrollItem(options?.id);
        scrollable.scroll({
          top: item?.offsetTop ?? scrollable.scrollHeight,
          left: 0,
          behavior: options?.smooth ? 'smooth' : 'auto',
        });
      },
      [getScrollItem],
    );

    React.useImperativeHandle(
      ref,
      () => {
        const element = scrollableRef.current as IScrollViewRef;
        element.getScrollState = () => scrollStateRef.current;
        element.getScrollItem = getScrollItem;
        element.getIsAtBottom = (distance = 60) => {
          const { scrollTop = 0, contentHeight = 0, containerHeight = 0 } =
            scrollStateRef.current;
          return scrollTop + containerHeight + distance >= contentHeight;
        };
        element.scrollToBottom = scrollToBottom;
        return element;
      },
      [getScrollItem, scrollToBottom],
    );

    React.useLayoutEffect(() => {
      const item = getScrollItem(defaultAnchorId);
      if (item && scrollableRef.current) {
        scrollableRef.current.scroll(0, item.offsetTop);
      }
    }, [defaultAnchorId, getScrollItem]);

    React.useEffect(() => {
      const scrollable = scrollableRef.current;
      const content = contentRef.current;
      if (!scrollable || !content) return undefined;

      function handleScroll(event?: Event) {
        if (!scrollable || !content) return;
        const previousScrollTop =
          scrollStateRef.current.scrollTop ?? scrollable.scrollTop;
        const scrollTop = scrollable.scrollTop;
        const containerHeight = scrollable.clientHeight;
        const contentHeight = content.clientHeight;
        const scrollTopDiff = previousScrollTop - scrollTop;

        if (event) {
          const items = Array.from(
            content.querySelectorAll<HTMLDivElement>('.scroll-item'),
          );
          const stickyItem = items.find((item) => item.offsetTop >= scrollTop);
          if (stickyItem) {
            scrollStateRef.current.stickyOffset = stickyItem.offsetTop;
            scrollStateRef.current.stickyId =
              stickyItem.getAttribute('data-scroll-anchor') ?? undefined;
          }
        }

        const now = Date.now();
        if (
          event &&
          scrollTopDiff > 0 &&
          scrollTop < scrollTopDistance &&
          !scrolling &&
          now - topCallbackTimeRef.current >= 300
        ) {
          topCallbackTimeRef.current = now;
          onScrollToTop?.();
        }
        if (
          event &&
          scrollTopDiff < 0 &&
          scrollTop > contentHeight - scrollBottomDistance - containerHeight &&
          !scrolling &&
          now - bottomCallbackTimeRef.current >= 300
        ) {
          bottomCallbackTimeRef.current = now;
          onScrollToBottom?.();
        }

        scrollStateRef.current = {
          ...scrollStateRef.current,
          scrollTop,
          containerHeight,
          contentHeight,
          scrollTopDiff,
        };
      }

      scrollable.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll();
      return () => scrollable.removeEventListener('scroll', handleScroll);
    }, [onScrollToBottom, onScrollToTop, scrollBottomDistance, scrolling, scrollTopDistance]);

    return (
      <div
        id={id}
        ref={scrollableRef}
        className={className}
        style={SCROLL_VIEW_STYLE}
      >
        <div
          ref={contentRef}
          style={{ visibility: visible !== false ? 'visible' : 'hidden' }}
        >
          {children}
        </div>
      </div>
    );
  },
);

function ScrollItem({ id, className, ...props }: ScrollItemProps) {
  return (
    <div
      {...props}
      data-scroll-anchor={id}
      className={cls(className, 'scroll-item')}
    />
  );
}

export function useScrollView() {
  return React.useMemo(() => ({ ScrollView, ScrollItem }), []);
}
