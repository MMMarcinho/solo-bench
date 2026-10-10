import { useSetState } from 'ahooks';
import React from 'react';

interface IControlledDetailsProps
  extends Omit<React.DetailsHTMLAttributes<HTMLDetailsElement>, 'children'> {
  /** 组件首次挂载时的展开状态。 */
  defaultOpen?: boolean;
  /** 展开状态变化后的通知。 */
  onOpenChange?: (isOpen: boolean) => void;
  /** 根据实际展开状态延迟渲染详情内容。 */
  children: (isOpen: boolean) => React.ReactNode;
}

interface IControlledDetailsState {
  /** details 当前是否处于展开状态。 */
  isOpen: boolean;
}

/**
 * 管理 details 的手动展开状态，并按实际状态延迟渲染详情内容。
 */
export function ControlledDetails({
  defaultOpen,
  className,
  children,
  onOpenChange,
  onToggle,
  ...rest
}: IControlledDetailsProps) {
  const [state, setState] = useSetState<IControlledDetailsState>({
    isOpen: defaultOpen ?? false,
  });

  /**
   * 跟踪用户切换的展开状态；执行中也允许收起详情，实时结果仍会继续更新。
   */
  function handleToggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    const isOpen = event.currentTarget.open;
    setState({ isOpen });
    onOpenChange?.(isOpen);
    onToggle?.(event);
  }

  return (
    <details
      className={className}
      open={state.isOpen}
      onToggle={handleToggle}
      {...rest}
    >
      {children(state.isOpen)}
    </details>
  );
}
