import { CLASS_PREFIX } from '@/constants';
import { useSetState } from 'ahooks';
import cls from 'classnames';
import React from 'react';
import './index.less';

const classPrefix = `${CLASS_PREFIX}-loading-bar`;
const DOT_MATRIX_DOTS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24,
];

interface ILoadingBarState {
  /**
   * 已持续秒数
   */
  elapsedSeconds: number;
}

/**
 * 格式化耗时，超过 60 秒后展示分钟。
 */
function formatElapsedTime(seconds: number) {
  if (seconds <= 60) {
    return `${seconds} 秒`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes} 分钟`;
  }

  return `${minutes} 分 ${remainingSeconds} 秒`;
}

/**
 * 根据开始时间戳计算已持续的完整秒数。
 */
function getElapsedSeconds(startTimestamp: number) {
  return Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000));
}

export interface ILoadingBarProps {
  /**
   * @description 计时起点的毫秒级时间戳；不传时以组件首次挂载时间为起点
   */
  startTimestamp?: number;
  /**
   * @description 自定义类名
   */
  className?: string;
  /**
   * @description 自定义样式
   */
  style?: React.CSSProperties;
  /**
   * @description 展示文案
   */
  text?: string;
  /**
   * @description 是否展示点阵图标
   */
  showDot?: boolean;
}

/**
 * 渲染搜索中的状态提示，由可选点阵图标和文案组成。
 */
export function LoadingBar(props: ILoadingBarProps) {
  const {
    startTimestamp,
    className,
    style,
    text = '正在思考',
    showDot = false,
  } = props;
  // 仅在首次挂载时确定起点，避免父组件重渲染导致计时重置。
  const startTimestampRef = React.useRef(startTimestamp ?? Date.now());
  const [state, setState] = useSetState<ILoadingBarState>({
    elapsedSeconds: getElapsedSeconds(startTimestampRef.current),
  });

  React.useEffect(() => {
    /**
     * 每次基于真实时间重新计算，避免浏览器暂停定时器后计时失准。
     */
    const updateElapsedSeconds = () => {
      setState({
        elapsedSeconds: getElapsedSeconds(startTimestampRef.current),
      });
    };

    updateElapsedSeconds();
    const timer = window.setInterval(updateElapsedSeconds, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div
      className={cls(classPrefix, className)}
      style={style}
      role="status"
      aria-live="polite"
    >
      {showDot && (
        <span className={`${classPrefix}__icon`} aria-hidden="true">
          {DOT_MATRIX_DOTS.map((dotIndex) => (
            <span
              key={dotIndex}
              className={`${classPrefix}__dot`}
              style={{
                animationDelay: `${
                  (Math.floor(dotIndex / 5) + (dotIndex % 5)) * 90
                }ms`,
              }}
            />
          ))}
        </span>
      )}
      <span className={`${classPrefix}__text`}>
        {text}
        <span className={`${classPrefix}__timer`}>
          （{formatElapsedTime(state.elapsedSeconds)}）
        </span>
      </span>
    </div>
  );
}
