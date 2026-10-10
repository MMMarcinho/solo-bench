import cls from 'classnames';
import React from 'react';
import './index.less';

const classPrefix = 'fim-avatar';

export interface IAvatarProps {
  src?: string;
  className?: string;
  style?: React.CSSProperties;
  isOnline?: boolean;
}

/** Visual-only avatar primitive embedded to keep the benchmark self-contained. */
export function Avatar(props: IAvatarProps) {
  const { src, className, isOnline, style } = props;

  return (
    <div className={cls(classPrefix, className)} style={style}>
      <div
        className={`${classPrefix}__image`}
        style={{ backgroundImage: src ? `url(${src})` : 'none' }}
      />
      {isOnline ? <div className={`${classPrefix}__dot`} /> : null}
    </div>
  );
}
