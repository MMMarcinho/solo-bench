import { CLASS_PREFIX } from '@/constants';
import { getAvatarInitial } from '@/utils/msg';
import cls from 'classnames';
import React from 'react';
import './index.less';

const classPrefix = `${CLASS_PREFIX}-welcome`;

export interface IWelcomeProps {
  /** 欢迎页展示的头像地址，未传时使用名称首字符头像。 */
  avatarUrl?: string;
  /** 主标题前缀。 */
  title?: React.ReactNode;
  /** 欢迎对象名称。 */
  name?: React.ReactNode;
  /** 标题下方的引导语。 */
  description?: React.ReactNode;
  /** 是否展示欢迎页骨架屏。 */
  skeleton?: boolean;
  /** 自定义类名。 */
  className?: string;
  /** 自定义样式。 */
  style?: React.CSSProperties;
}

/**
 * 渲染会话初始状态的欢迎引导。
 */
export function Welcome(props: IWelcomeProps) {
  const {
    avatarUrl,
    title = 'Hi，我是',
    name = 'AI 助手',
    description,
    skeleton = false,
    className,
    style,
  } = props || {};

  return (
    <div
      className={cls(
        classPrefix,
        { [`${classPrefix}--skeleton`]: skeleton },
        className,
      )}
      style={style}
      role={skeleton ? 'status' : undefined}
      aria-busy={skeleton || undefined}
      aria-label={skeleton ? '欢迎页加载中' : undefined}
    >
      {skeleton ? (
        <>
          <span className={`${classPrefix}__skeleton__avatar`} />
          <span className={`${classPrefix}__skeleton__title`}>
            <span className={`${classPrefix}__skeleton__content`} />
          </span>
          {description !== undefined ? (
            <span className={`${classPrefix}__skeleton__description`}>
              <span className={`${classPrefix}__skeleton__content`} />
            </span>
          ) : null}
        </>
      ) : (
        <>
          <div className={`${classPrefix}__avatar`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              <span
                className={`${classPrefix}__avatar__fallback`}
                role="img"
                aria-label={`${typeof name === 'string' ? name : '机器人'}头像`}
              >
                {getAvatarInitial(typeof name === 'string' ? name : undefined)}
              </span>
            )}
          </div>
          <div className={`${classPrefix}__title`}>
            {title}
            <span>{name}</span>
          </div>
          <div className={`${classPrefix}__description`}>{description}</div>
        </>
      )}
    </div>
  );
}
