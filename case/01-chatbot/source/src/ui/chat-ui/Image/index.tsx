import { CLASS_PREFIX } from '@/constants';
import { useSetState } from 'ahooks';
import { Tooltip } from 'antd6';
import cls from 'classnames';
import { ImageOff, Minus, Plus, RotateCwSquare, X } from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';
import './index.less';

const classPrefix = `${CLASS_PREFIX}-image`;
const MIN_PREVIEW_SCALE = 0.25;
const MAX_PREVIEW_SCALE = 4;
const PREVIEW_SCALE_STEP = 0.25;

type PreviewAction = 'zoom-in' | 'zoom-out' | 'rotate';

interface IImageState {
  /**
   * 已完成加载的图片地址
   */
  loadedSrc?: string;
  /**
   * 加载失败的图片地址
   */
  errorSrc?: string;
  /**
   * 是否打开图片预览
   */
  previewVisible: boolean;
  /**
   * 图片重试次数，用于重新挂载原图
   */
  retryCount: number;
  /**
   * 预览图片缩放比例
   */
  previewScale: number;
  /**
   * 预览图片旋转角度
   */
  previewRotation: number;
}

export interface IImageProps
  extends Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    'className' | 'onError' | 'onLoad' | 'style'
  > {
  /**
   * @description 图片地址
   */
  src?: string;
  /**
   * @description 图片替代文本
   */
  alt?: string;
  /**
   * @description 是否允许点击预览
   * @default true
   */
  preview?: boolean;
  /**
   * @description 自定义类名
   */
  className?: string;
  /**
   * @description 容器自定义样式
   */
  style?: React.CSSProperties;
  /**
   * @description 图片自定义样式
   */
  imageStyle?: React.CSSProperties;
  /**
   * @description 图片加载完成回调
   */
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  /**
   * @description 图片加载失败回调
   */
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

/**
 * 渲染支持渐进式加载和全屏预览的图片，组件内部仅使用行内元素。
 */
export function Image(props: IImageProps) {
  const {
    alt = '',
    className,
    decoding = 'async',
    imageStyle,
    loading = 'lazy',
    onClick,
    onError,
    onLoad,
    preview = true,
    src,
    style,
    ...imageProps
  } = props;
  const imageRef = React.useRef<HTMLImageElement>(null);
  const closeButtonRef = React.useRef<HTMLSpanElement>(null);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);
  const [state, setState] = useSetState<IImageState>({
    loadedSrc: undefined,
    errorSrc: undefined,
    previewVisible: false,
    retryCount: 0,
    previewScale: 1,
    previewRotation: 0,
  });
  const isLoaded = !src || state.loadedSrc === src;
  const isError = Boolean(src && state.errorSrc === src);
  const canPreview = preview && isLoaded && !isError && Boolean(src);

  /**
   * 图片地址变化或命中浏览器缓存时，同步当前加载结果。
   */
  React.useEffect(() => {
    const imageElement = imageRef.current;

    if (!imageElement?.complete || !src) {
      return;
    }

    setState(
      imageElement.naturalWidth
        ? { loadedSrc: src, errorSrc: undefined }
        : { loadedSrc: undefined, errorSrc: src },
    );
  }, [src]);

  /**
   * 预览打开后锁定页面滚动，并支持 Esc 关闭与焦点还原。
   */
  React.useEffect(() => {
    if (!state.previewVisible) {
      return undefined;
    }

    previousActiveElementRef.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    /**
     * 处理预览中的全局键盘操作。
     */
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setState({
          previewVisible: false,
          previewScale: 1,
          previewRotation: 0,
        });
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [state.previewVisible]);

  /**
   * 图片加载完成后展示原图，并保留调用方回调。
   */
  function onImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    setState({ loadedSrc: src, errorSrc: undefined });
    onLoad?.(event);
  }

  /**
   * 图片加载失败后结束占位状态，并保留调用方回调。
   */
  function onImageError(event: React.SyntheticEvent<HTMLImageElement>) {
    setState({ loadedSrc: undefined, errorSrc: src });
    onError?.(event);
  }

  /**
   * 点击原图时先执行调用方逻辑，再按配置打开预览。
   */
  function onImageClick(event: React.MouseEvent<HTMLImageElement>) {
    onClick?.(event);

    if (!event.defaultPrevented && canPreview) {
      setState({
        previewVisible: true,
        previewScale: 1,
        previewRotation: 0,
      });
    }
  }

  /**
   * 支持通过键盘操作图片和预览关闭按钮。
   */
  function onActionKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    setState({
      previewVisible: !state.previewVisible,
      previewScale: 1,
      previewRotation: 0,
    });
  }

  /**
   * 关闭图片预览。
   */
  function closePreview() {
    setState({
      previewVisible: false,
      previewScale: 1,
      previewRotation: 0,
    });
  }

  /**
   * 在允许范围内调整预览图片缩放比例。
   */
  function changePreviewScale(scaleDelta: number) {
    const nextScale = Math.min(
      MAX_PREVIEW_SCALE,
      Math.max(MIN_PREVIEW_SCALE, state.previewScale + scaleDelta),
    );

    setState({ previewScale: Number(nextScale.toFixed(2)) });
  }

  /**
   * 执行预览工具栏操作。
   */
  function runPreviewAction(action: PreviewAction) {
    if (action === 'zoom-in') {
      changePreviewScale(PREVIEW_SCALE_STEP);
      return;
    }

    if (action === 'zoom-out') {
      changePreviewScale(-PREVIEW_SCALE_STEP);
      return;
    }

    // 角度持续累加，避免 270° 回到 0° 时过渡反向旋转一整圈。
    setState({ previewRotation: state.previewRotation + 90 });
  }

  /**
   * 从工具栏事件目标中读取并执行操作。
   */
  function getPreviewAction(eventTarget: EventTarget) {
    const actionElement = (eventTarget as Element).closest<HTMLElement>(
      '[data-preview-action]',
    );

    return actionElement?.dataset.previewAction as PreviewAction | undefined;
  }

  /**
   * 处理预览工具栏点击，并阻止事件触发遮罩关闭。
   */
  function onPreviewToolbarClick(event: React.MouseEvent<HTMLSpanElement>) {
    event.stopPropagation();
    const action = getPreviewAction(event.target);

    if (action) {
      runPreviewAction(action);
    }
  }

  /**
   * 支持通过键盘操作预览工具栏。
   */
  function onPreviewToolbarKeyDown(
    event: React.KeyboardEvent<HTMLSpanElement>,
  ) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const action = getPreviewAction(event.target);

    if (action) {
      event.preventDefault();
      runPreviewAction(action);
    }
  }

  /**
   * 使用鼠标滚轮缩放预览图片。
   */
  function onPreviewWheel(event: React.WheelEvent<HTMLImageElement>) {
    event.preventDefault();
    event.stopPropagation();
    changePreviewScale(
      event.deltaY < 0 ? PREVIEW_SCALE_STEP : -PREVIEW_SCALE_STEP,
    );
  }

  /**
   * 拖动进度条时实时更新预览图片缩放比例。
   */
  function onPreviewScaleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setState({ previewScale: Number(event.target.value) / 100 });
  }

  /**
   * 清除当前错误状态并重新加载原图。
   */
  function retryImage() {
    setState({
      loadedSrc: undefined,
      errorSrc: undefined,
      retryCount: state.retryCount + 1,
    });
  }

  /**
   * 支持通过键盘触发图片重试。
   */
  function onRetryKeyDown(event: React.KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    retryImage();
  }

  const previewScalePercent = Math.round(state.previewScale * 100);
  const previewScaleProgress =
    ((state.previewScale - MIN_PREVIEW_SCALE) /
      (MAX_PREVIEW_SCALE - MIN_PREVIEW_SCALE)) *
    100;
  const previewContent =
    state.previewVisible && typeof document !== 'undefined'
      ? createPortal(
          <span
            className={`${classPrefix}__preview`}
            role="dialog"
            aria-label={alt ? `${alt}图片预览` : '图片预览'}
            aria-modal="true"
          >
            <img
              className={`${classPrefix}__preview-image`}
              style={{
                transform: `scale(${state.previewScale}) rotate(${state.previewRotation}deg)`,
              }}
              src={src}
              alt={alt}
              onWheel={onPreviewWheel}
            />
            <span
              className={`${classPrefix}__preview-toolbar`}
              role="toolbar"
              aria-label="图片预览工具栏"
              onClick={onPreviewToolbarClick}
              onKeyDown={onPreviewToolbarKeyDown}
            >
              <span
                className={`${classPrefix}__preview-action`}
                role="button"
                tabIndex={0}
                data-preview-action="zoom-out"
                aria-label="缩小图片"
                aria-disabled={state.previewScale <= MIN_PREVIEW_SCALE}
              >
                <Minus aria-hidden="true" />
              </span>
              <input
                className={`${classPrefix}__preview-slider`}
                type="range"
                min={MIN_PREVIEW_SCALE * 100}
                max={MAX_PREVIEW_SCALE * 100}
                step={5}
                value={previewScalePercent}
                aria-label="调整图片缩放比例"
                style={{
                  background: `linear-gradient(to right, rgba(255, 255, 255, 88%) ${previewScaleProgress}%, rgba(255, 255, 255, 24%) ${previewScaleProgress}%)`,
                }}
                onChange={onPreviewScaleChange}
              />
              <span
                className={`${classPrefix}__preview-scale`}
                aria-live="polite"
              >
                {previewScalePercent}%
              </span>
              <span
                className={`${classPrefix}__preview-action`}
                role="button"
                tabIndex={0}
                data-preview-action="zoom-in"
                aria-label="放大图片"
                aria-disabled={state.previewScale >= MAX_PREVIEW_SCALE}
              >
                <Plus aria-hidden="true" />
              </span>
              <span
                className={`${classPrefix}__preview-action`}
                role="button"
                tabIndex={0}
                data-preview-action="rotate"
                aria-label="顺时针旋转图片"
              >
                <RotateCwSquare aria-hidden="true" />
              </span>
            </span>
            <span
              ref={closeButtonRef}
              className={`${classPrefix}__preview-close`}
              role="button"
              tabIndex={0}
              aria-label="关闭图片预览"
              onClick={closePreview}
              onKeyDown={onActionKeyDown}
            >
              <X aria-hidden="true" />
            </span>
          </span>,
          document.body,
        )
      : null;

  return (
    <>
      <span
        className={cls(classPrefix, className, {
          [`${classPrefix}--loading`]: !isLoaded && !isError,
          [`${classPrefix}--error`]: isError,
          [`${classPrefix}--previewable`]: canPreview,
        })}
        style={style}
      >
        {isError ? (
          <Tooltip title="图片加载失败，点击重试">
            <span
              className={`${classPrefix}__error`}
              style={{
                width: imageProps.width,
                height: imageProps.height,
              }}
              role="button"
              tabIndex={0}
              aria-label={
                alt ? `${alt}加载失败，点击重试` : '图片加载失败，点击重试'
              }
              onClick={retryImage}
              onKeyDown={onRetryKeyDown}
            >
              <ImageOff aria-hidden="true" />
            </span>
          </Tooltip>
        ) : (
          <img
            key={`${src}-${state.retryCount}`}
            {...imageProps}
            ref={imageRef}
            className={`${classPrefix}__original`}
            style={imageStyle}
            src={src}
            alt={alt}
            decoding={decoding}
            loading={loading}
            role={canPreview ? 'button' : undefined}
            tabIndex={canPreview ? 0 : undefined}
            aria-label={canPreview && alt ? `${alt}，点击预览` : undefined}
            onClick={onImageClick}
            onError={onImageError}
            onKeyDown={canPreview ? onActionKeyDown : undefined}
            onLoad={onImageLoad}
          />
        )}
      </span>
      {previewContent}
    </>
  );
}
