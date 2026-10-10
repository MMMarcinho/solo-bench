import cls from 'classnames';
import { ChevronRight } from 'lucide-react';
import React from 'react';
import { CLASS_PREFIX } from '../../../constants';
import type { IToolCall } from '../../../typings/tool';
import type { ToolCallIcon } from '../../locale';
import {
  formatToolCallValue,
  hasToolCallPayload,
  inferToolCallOutputLanguage,
  splitToolCallOutput,
  type IToolCallOutputSection,
} from '../../utils';
import { ControlledDetails } from '../ControlledDetails';
import './index.less';

const classPrefix = `${CLASS_PREFIX}-tool-call`;

/** 延迟加载详情中的代码高亮组件，避免工具调用折叠时增加首屏包体积。 */
const CodeBlock = React.lazy(() =>
  import('../../../CodeBlock').then(({ CodeBlock: Component }) => ({
    default: Component,
  })),
);

export interface IToolCallItemProps {
  /** 当前工具调用数据。 */
  toolCall: IToolCall;
  /** 工具调用的展示文案。 */
  displayName: string;
  /** 工具调用的状态图标。 */
  icon: ToolCallIcon;
  /** 当前工具项是否处于流式执行中。 */
  streaming?: boolean;
  /** 已格式化的工具调用耗时。 */
  durationText?: string;
  /** 展开状态变化后的通知。 */
  onOpenChange?: (isOpen: boolean) => void;
}

/**
 * 按输出片段类型渲染普通文本或 diff。
 */
function renderToolCallOutputSection(options: {
  section: IToolCallOutputSection;
  index: number;
}): React.ReactNode {
  const { section, index } = options;
  return (
    <CodeBlock
      className={`${classPrefix}__payload`}
      lang={section.type === 'diff' ? 'diff' : 'text'}
      key={`${section.type}-${index}`}
    >
      {section.content}
    </CodeBlock>
  );
}

/**
 * 渲染工具调用详情；仅在工具项展开后挂载，避免折叠时处理大文本或加载重组件。
 */
function ToolCallDetail({ toolCall }: { toolCall: IToolCall }) {
  const input = formatToolCallValue(toolCall.input);
  const output = formatToolCallValue(toolCall.output);
  const outputLanguage = inferToolCallOutputLanguage(toolCall);
  const codeOutputLanguage = output.isJson ? output.lang : outputLanguage;
  const outputSections = codeOutputLanguage
    ? []
    : splitToolCallOutput(output.content);
  const hasOutput =
    toolCall.output !== undefined &&
    toolCall.output !== null &&
    !!output.content;
  const hasPayload = !!(input.content || hasOutput);

  if (!hasPayload) return null;

  return (
    <React.Suspense
      fallback={<div className={`${classPrefix}__content`}>正在加载...</div>}
    >
      <div className={`${classPrefix}__content`}>
        {input.content && (
          <div className={`${classPrefix}__io`}>
            <div className={`${classPrefix}__io-title`}>input</div>
            <CodeBlock className={`${classPrefix}__payload`} lang={input.lang}>
              {input.content}
            </CodeBlock>
          </div>
        )}
        {hasOutput && (
          <div className={`${classPrefix}__io`}>
            <div className={`${classPrefix}__io-title`}>output</div>
            {codeOutputLanguage ? (
              <CodeBlock
                className={`${classPrefix}__payload`}
                lang={codeOutputLanguage}
              >
                {output.content}
              </CodeBlock>
            ) : (
              <div className={`${classPrefix}__output-sections`}>
                {outputSections.map((section, sectionIndex) =>
                  renderToolCallOutputSection({ section, index: sectionIndex }),
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </React.Suspense>
  );
}

/**
 * 渲染单条工具调用；单条模式与多条模式共用，避免展示和详情逻辑分叉。
 */
export function ToolCallItem({
  toolCall,
  displayName,
  icon: ToolIcon,
  streaming,
  durationText,
  onOpenChange,
}: IToolCallItemProps) {
  const hasPayload = hasToolCallPayload(toolCall);

  return (
    <ControlledDetails
      className={cls(`${classPrefix}__item`, {
        [`${classPrefix}__item--streaming`]: streaming,
      })}
      onOpenChange={onOpenChange}
    >
      {(isOpen) => (
        <>
          <summary className={`${classPrefix}__summary`}>
            {ToolIcon(`${classPrefix}__status`)}
            <span className={`${classPrefix}__title`}>{displayName}</span>
            {durationText ? (
              <span className={`${classPrefix}__duration`}>{durationText}</span>
            ) : null}
            {hasPayload && <ChevronRight className={`${classPrefix}__arrow`} />}
          </summary>
          {isOpen && hasPayload ? <ToolCallDetail toolCall={toolCall} /> : null}
        </>
      )}
    </ControlledDetails>
  );
}
