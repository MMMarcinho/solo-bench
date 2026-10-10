import { CLASS_PREFIX } from '@/constants';
import { useSetState } from 'ahooks';
import cls from 'classnames';
import React, {
  forwardRef,
  memo,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type {
  IChatSenderSuggestionProps,
  ISuggestionItem,
  SuggestionItems,
} from '../../index';

/**
 * 快捷指令模块独立维护列表计算和键盘选中状态。
 */
const classPrefix = `${CLASS_PREFIX}-chat-sender`;

/**
 * 快捷指令面板属性。
 */
interface ICommandPanelProps {
  items?: IChatSenderSuggestionProps['items'];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (params: ICommandSelectParams) => void;
}

/**
 * 快捷指令选中结果。
 */
export interface ICommandSelectParams {
  value: string;
  items: SuggestionItems;
}

/**
 * ChatSender 调用快捷指令面板的命令接口。
 */
export interface ICommandPanelRef {
  handleKeyDown: (event: React.KeyboardEvent) => boolean;
  resetActiveIndex: () => void;
}

/**
 * 展开面板时获取快捷指令，避免无关状态更新重复执行调用方计算。
 */
function getCommandItems(
  items?: IChatSenderSuggestionProps['items'],
): SuggestionItems {
  return typeof items === 'function' ? items() : items || [];
}

/**
 * 独立管理指令计算和键盘选中状态，防止方向键更新整个 Sender。
 */
function InnerCommandPanel(
  props: ICommandPanelProps,
  ref: React.Ref<ICommandPanelRef>,
) {
  const { items, open, onOpenChange, onSelect } = props;
  const [state, setState] = useSetState({ activeIndex: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;
  const commandItems = useMemo(
    () => (open ? getCommandItems(items) : []),
    [items, open],
  );
  const activeIndex = commandItems.length
    ? Math.min(state.activeIndex, commandItems.length - 1)
    : 0;
  const visible = open && commandItems.length > 0;

  /**
   * 选中指令并关闭面板。
   */
  function selectItem(item: ISuggestionItem) {
    onOpenChange(false);
    if (stateRef.current.activeIndex !== 0) {
      setState({ activeIndex: 0 });
    }
    onSelect?.({ value: item.value, items: [item] });
  }

  /**
   * 对外提供键盘处理和索引复位能力。
   */
  useImperativeHandle(ref, () => ({
    handleKeyDown(event: React.KeyboardEvent) {
      if (!visible) {
        return false;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setState({
          activeIndex: (activeIndex + 1) % commandItems.length,
        });
        return true;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setState({
          activeIndex:
            (activeIndex - 1 + commandItems.length) % commandItems.length,
        });
        return true;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        selectItem(commandItems[activeIndex]);
        return true;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        return true;
      }
      return false;
    },
    resetActiveIndex() {
      if (stateRef.current.activeIndex !== 0) {
        setState({ activeIndex: 0 });
      }
    },
  }));

  if (!visible) {
    return null;
  }

  return (
    <div className={`${classPrefix}__command-panel`} role="listbox">
      <div className={`${classPrefix}__command-panel__title`}>快捷指令</div>
      <div className={`${classPrefix}__command-panel__list`}>
        {commandItems.map((item, index) => (
          <button
            key={`${item.value}-${index}`}
            className={cls(`${classPrefix}__command-panel__item`, {
              [`${classPrefix}__command-panel__item--active`]:
                index === activeIndex,
            })}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectItem(item)}
          >
            <span className={`${classPrefix}__command-panel__item-label`}>
              {item.label}
            </span>
            {item.extra ? (
              <span className={`${classPrefix}__command-panel__item-extra`}>
                {item.extra}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className={`${classPrefix}__command-panel__footer`}>
        <span>↑↓ 切换</span>
        <span>Enter 选择</span>
        <span>Esc 关闭</span>
      </div>
    </div>
  );
}

export const CommandPanel = memo(forwardRef(InnerCommandPanel));
