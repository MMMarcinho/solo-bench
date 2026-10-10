import { useSetState } from 'ahooks';
import cls from 'classnames';
import {
  ChevronRight,
  Eye,
  Globe,
  Image,
  ListChecks,
  Pencil,
  Search,
  SquareTerminal,
} from 'lucide-react';
import React from 'react';
import { CLASS_PREFIX } from '../constants';
import { ToolCategory, type IToolCall } from '../typings/tool';
import { builtinClassify } from '../utils/tool';
import { ControlledDetails } from './components/ControlledDetails';
import { ToolCallItem } from './components/ToolCallItem';
import './index.less';
import type { IToolCallConfig } from './locale';
import {
  classifyCodexTool,
  CodexCategory,
  getCodexToolDisplayName,
  mergeLocale,
  type MergedLocale,
} from './locale';

export type {
  ClassifyFn,
  CodexClassifyFn,
  CodexParseFn,
  IToolCallConfig,
  IToolCallLocale,
  ToolCallIcon,
  ToolCallIconMap,
  ToolCallLocaleCtx,
} from './locale';

const classPrefix = `${CLASS_PREFIX}-tool-call`;

export interface IToolCallProps {
  data?: IToolCall[];
  className?: string;
  style?: React.CSSProperties;
  /**
   * 是否聚合多个工具调用为单条摘要(可二级展开)。默认 true;
   * 传 false 时多个工具调用各自独立平铺、不收进外层摘要。
   */
  aggregate?: boolean;
  /** 是否展示已结束工具的耗时，默认关闭。 */
  showDuration?: boolean;
  /**
   * 配置项:文案覆盖、工具识别规则、codex 解析规则。全部可选,不传时行为与现状一致。
   */
  config?: IToolCallConfig;
}

interface IToolCallState {
  /** 单条调用被手动展开后，切换为聚合展示时保留该展开状态。 */
  isStandaloneToolCallOpen: boolean;
}

// ─── 工具分类与图标 ──────────────────────────────────────────────────

/**
 * 统一分类入口(图标、摘要共用)。优先使用方 classify,其次内置规则,兜底 'other'。
 */
function classifyTool(name: string, config?: IToolCallConfig): ToolCategory {
  const custom = config?.classify?.(name);
  if (custom) return custom;

  const builtin = builtinClassify(name);
  if (builtin) return builtin;

  const lowerName = name.toLowerCase();
  if (lowerName.startsWith('codex_')) {
    const codexCat = config?.codex?.classify?.(name) ?? classifyCodexTool(name);
    if (codexCat === CodexCategory.Command) return ToolCategory.Command;
    if (codexCat === CodexCategory.Read) return ToolCategory.Read;
    if (codexCat === CodexCategory.Edit) return ToolCategory.Edit;
    if (codexCat === CodexCategory.Search) return ToolCategory.Search;
    // codex 'list' 在顶层归为 other(图标 SquareTerminal、摘要走 other 桶,与现状一致)
  }

  return ToolCategory.Other;
}

/**
 * 内置默认图标渲染器(基于 lucide)。仅在消费方未覆盖某类别时使用。
 * 渲染函数形态统一为 (className) => ReactNode,与消费方自定义图标一致,
 * 组件不强依赖具体图标库:消费方传的渲染器可返回任何来源的节点。
 */
const BUILTIN_ICON: Record<
  ToolCategory,
  (className: string) => React.ReactNode
> = {
  [ToolCategory.Command]: (cls) => <SquareTerminal className={cls} />,
  [ToolCategory.Read]: (cls) => <Eye className={cls} />,
  [ToolCategory.Edit]: (cls) => <Pencil className={cls} />,
  [ToolCategory.Image]: (cls) => <Image className={cls} />,
  [ToolCategory.Web]: (cls) => <Globe className={cls} />,
  [ToolCategory.Search]: (cls) => <Search className={cls} />,
  [ToolCategory.Plan]: (cls) => <ListChecks className={cls} />,
  [ToolCategory.Other]: (cls) => <SquareTerminal className={cls} />,
};

/**
 * 取某类别对应图标渲染函数:优先使用方 config.icons 覆盖,否则内置图标。
 */
function getCategoryIcon(category: ToolCategory, config?: IToolCallConfig) {
  return config?.icons?.[category] ?? BUILTIN_ICON[category];
}

/**
 * 取某工具名对应图标的渲染函数(根据归类结果派发)。
 */
function getToolIcon(name: string, config?: IToolCallConfig) {
  return getCategoryIcon(classifyTool(name, config), config);
}

/**
 * 将工具调用时间转换为毫秒时间戳，兼容数字时间戳和日期字符串。
 */
function getTimestamp(value: number | string): number {
  if (typeof value === 'string' && !value.trim()) return Number.NaN;

  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? new Date(value).getTime() : numericValue;
}

/**
 * 将毫秒耗时格式化为更易读的中文文案。
 */
function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${Math.round(durationMs)} 毫秒`;
  if (durationMs < 60000) {
    const seconds = Math.round(durationMs / 100) / 10;
    return `${seconds} 秒`;
  }

  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return seconds > 0 ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分钟`;
}

/**
 * 计算单条工具调用耗时；工具尚未结束或时间无效时不展示。
 */
function getToolCallDurationText(toolCall: IToolCall): string {
  if (
    toolCall.streaming ||
    toolCall.startedAt === undefined ||
    toolCall.endedAt === undefined
  ) {
    return '';
  }

  const startedAt = getTimestamp(toolCall.startedAt);
  const endedAt = getTimestamp(toolCall.endedAt);
  const durationMs = endedAt - startedAt;

  if (!Number.isFinite(durationMs) || durationMs < 0) return '';

  return `耗时 ${formatDuration(durationMs)}`;
}

// ─── 参数解析辅助 ────────────────────────────────────────────────────

/**
 * 从工具 input 中提取参数对象。
 */
function parseToolInput(input: unknown): Record<string, unknown> {
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (input && typeof input === 'object') {
    return input as Record<string, unknown>;
  }
  return {};
}

/**
 * 解析 input 得到参数对象 + 原始 args 字符串(codex apply_patch 正则等需要)。
 */
function parseToolInputWithArgsStr(input: unknown): {
  parsed: Record<string, unknown>;
  argsStr: string;
} {
  const argsStr =
    (typeof input === 'string' ? input : JSON.stringify(input || {})) || '{}';
  return { parsed: parseToolInput(input), argsStr };
}

// ─── 工具显示名称 ────────────────────────────────────────────────────

/**
 * 获取工具的显示名称，附带详细信息（文件名/命令/网址等）。
 * 文案取自 mergedLocale,逻辑(精确名称分发/codex 解析)与改造前一致。
 */
function getToolDisplayName(
  toolCall: IToolCall,
  locale: MergedLocale,
  config?: IToolCallConfig,
): string {
  const name = toolCall.name || 'unknown';
  const lowerName = name.toLowerCase();
  const { parsed, argsStr } = parseToolInputWithArgsStr(toolCall.input);
  const ctx = { parsed, argsStr, category: classifyTool(name, config) };

  // codex_* 走 codex 解析(可被使用方 parse 覆盖)
  if (lowerName.startsWith('codex_')) {
    const custom = config?.codex?.parse?.(name, toolCall.input, {
      parsed,
      argsStr,
      locale: locale.codex,
    });
    if (custom !== undefined) return custom;
    return getCodexToolDisplayName(
      name,
      toolCall.input,
      locale.codex,
      toolCall.streaming,
    );
  }

  switch (lowerName) {
    case 'read':
      return locale.read(toolCall, ctx);
    case 'write':
    case 'edit':
      return locale.edit(toolCall, ctx);
    case 'exec':
      return locale.command(toolCall, ctx);
    case 'web_fetch':
      return locale.web(toolCall, ctx);
    case 'image':
      return locale.image(toolCall, ctx);
    case 'update_plan':
      return locale.plan(toolCall, ctx);
    case 'search':
    case 'grep':
    case 'find_files':
      return locale.search(toolCall, ctx);
    default:
      return locale.fallback(toolCall, ctx);
  }
}

// ─── 摘要生成 ────────────────────────────────────────────────────────

function getToolCallSummary(
  data: IToolCall[],
  locale: MergedLocale,
  config?: IToolCallConfig,
): string {
  type Bucket = Exclude<ToolCategory, ToolCategory.Other | ToolCategory.Plan>;
  // 每档的未完成数(streaming)与已完成数,分别生成「正在 xxx」「已 xxx」两段
  const buckets: Record<Bucket, { running: number; done: number }> = {
    [ToolCategory.Command]: { running: 0, done: 0 },
    [ToolCategory.Read]: { running: 0, done: 0 },
    [ToolCategory.Edit]: { running: 0, done: 0 },
    [ToolCategory.Image]: { running: 0, done: 0 },
    [ToolCategory.Web]: { running: 0, done: 0 },
    [ToolCategory.Search]: { running: 0, done: 0 },
  };

  data.forEach((item) => {
    const name = item.name || 'unknown';
    const category = classifyTool(name, config);
    // 未匹配到具体档(read/edit/search/image/web)的工具——含 other 与 plan——
    // 摘要里并入「运行命令」档,与单条展开的兜底 `已运行 ${name}` 语义一致。
    const bucket: Bucket =
      category === ToolCategory.Other ||
      category === ToolCategory.Plan ||
      category === ToolCategory.Command
        ? ToolCategory.Command
        : category;
    if (item.streaming) buckets[bucket].running += 1;
    else buckets[bucket].done += 1;
  });

  const parts: string[] = [];
  const push = (b: Bucket) => {
    const { running, done } = buckets[b];
    // 有未完成项 → 进行态段;有已完成项 → 完成态段;两者并存时各成一段
    if (running > 0) parts.push(locale.summary[b](running, true));
    if (done > 0) parts.push(locale.summary[b](done, false));
  };
  push(ToolCategory.Command);
  push(ToolCategory.Read);
  push(ToolCategory.Edit);
  push(ToolCategory.Search);
  push(ToolCategory.Image);
  push(ToolCategory.Web);

  return parts.join(locale.summary.join());
}

/**
 * 渲染工具调用列表；多条调用可选聚合摘要，单条和非聚合多条直接复用同一工具项。
 */
export const ToolCall = React.memo(function ToolCall(props: IToolCallProps) {
  const {
    className,
    style,
    data,
    aggregate = true,
    showDuration = false,
    config,
  } = props || {};
  const [state, setState] = useSetState<IToolCallState>({
    isStandaloneToolCallOpen: false,
  });

  const mergedLocale = React.useMemo(
    () => mergeLocale(config?.locale),
    [config?.locale],
  );

  if (!Array.isArray(data) || data.length === 0) return null;

  // 任一子项仍在执行(收到 toolUse 但尚未配对到 toolResult) → 展开 + 溜光。
  const groupStreaming = data.some((item) => item.streaming);
  const shouldAggregate = aggregate && data.length > 1;
  const isSingleToolCall = data.length === 1;

  /**
   * 记录单条工具调用的手动展开状态，以便新增调用切换为聚合结构时继续展开。
   */
  function handleStandaloneToolCallOpenChange(isOpen: boolean) {
    setState({ isStandaloneToolCallOpen: isOpen });
  }

  // 单条调用和非聚合的多条调用直接平铺同一套工具项。
  if (!shouldAggregate) {
    return (
      <div
        className={cls(
          classPrefix,
          { [`${classPrefix}--streaming`]: groupStreaming },
          className,
        )}
        style={style}
      >
        {data.map((toolCall, index) => {
          const name = toolCall.name || 'unknown';
          const itemStreaming = toolCall.streaming;
          return (
            <ToolCallItem
              displayName={getToolDisplayName(toolCall, mergedLocale, config)}
              icon={getToolIcon(name, config)}
              key={toolCall.id || `${name}-${index}`}
              onOpenChange={
                isSingleToolCall
                  ? handleStandaloneToolCallOpenChange
                  : undefined
              }
              streaming={itemStreaming}
              durationText={
                showDuration ? getToolCallDurationText(toolCall) : undefined
              }
              toolCall={toolCall}
            />
          );
        })}
      </div>
    );
  }

  // 聚合模式仅额外渲染组摘要，子工具项仍复用同一套渲染逻辑。
  const summary = getToolCallSummary(data, mergedLocale, config);

  return (
    <div
      className={cls(
        classPrefix,
        { [`${classPrefix}--streaming`]: groupStreaming },
        className,
      )}
      style={style}
    >
      <ControlledDetails
        className={cls(`${classPrefix}__group`, {
          [`${classPrefix}__group--streaming`]: groupStreaming,
        })}
        defaultOpen={state.isStandaloneToolCallOpen}
      >
        {(isOpen) => (
          <>
            <summary className={`${classPrefix}__summary`}>
              <span className={`${classPrefix}__title`}>{summary}</span>
              <ChevronRight className={`${classPrefix}__arrow`} />
            </summary>

            {isOpen ? (
              <div className={`${classPrefix}__group-items`}>
                {data.map((toolCall, index) => {
                  const name = toolCall.name || 'unknown';
                  const itemStreaming = toolCall.streaming;

                  return (
                    <ToolCallItem
                      displayName={getToolDisplayName(
                        toolCall,
                        mergedLocale,
                        config,
                      )}
                      icon={getToolIcon(name, config)}
                      key={toolCall.id || `${name}-${index}`}
                      streaming={itemStreaming}
                      durationText={
                        showDuration
                          ? getToolCallDurationText(toolCall)
                          : undefined
                      }
                      toolCall={toolCall}
                    />
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </ControlledDetails>
    </div>
  );
});
