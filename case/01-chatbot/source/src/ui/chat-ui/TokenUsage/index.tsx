import cls from 'classnames';
import React from 'react';
import { CLASS_PREFIX } from '../constants';
import './index.less';

const classPrefix = `${CLASS_PREFIX}-token-usage`;

export interface ITokenUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
}

export interface ITokenUsageProps {
  /**
   * @description Token 消耗信息
   */
  usage?: ITokenUsage;
  /**
   * @description 自定义类名
   */
  className?: string;
  /**
   * @description 自定义样式
   */
  style?: React.CSSProperties;
}

function formatTokenCount(value: number): string {
  const absValue = Math.abs(value);
  const units = [
    { suffix: 'B', value: 1_000_000_000 },
    { suffix: 'M', value: 1_000_000 },
    { suffix: 'K', value: 1_000 },
  ];
  const unit = units.find((item) => absValue >= item.value);

  if (!unit) {
    return String(value);
  }

  return `${(value / unit.value).toFixed(1)}${unit.suffix}`;
}

export function TokenUsage(props: ITokenUsageProps) {
  const { className, style, usage } = props || {};

  if (!usage) {
    return null;
  }

  const items = [
    { label: 'in', value: usage.input },
    { label: 'out', value: usage.output },
    { label: 'cache read', value: usage.cacheRead },
    { label: 'cache write', value: usage.cacheWrite },
  ].filter(
    (item): item is { label: string; value: number } =>
      typeof item.value === 'number',
  );

  if (items.length === 0 || items.every((item) => item.value === 0)) {
    return null;
  }

  return (
    <div className={cls(classPrefix, className)} style={style}>
      {items.map((item) => (
        <span key={item.label}>
          {formatTokenCount(item.value)} {item.label}
        </span>
      ))}
    </div>
  );
}
