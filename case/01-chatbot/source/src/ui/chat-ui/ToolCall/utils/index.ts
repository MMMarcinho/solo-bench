import { normalizeCodeLanguage } from '../../constants/file';
import type { IToolCall } from '../../typings/tool';

function safeJsonString(value: unknown, replacer: null, space: number) {
  try {
    return JSON.stringify(value, replacer, space);
  } catch {
    return '';
  }
}

export interface IFormattedToolCallValue {
  content: string;
  lang: string;
  /** 是否为可交给 CodeBlock 渲染的 JSON。 */
  isJson: boolean;
}

export interface IToolCallOutputSection {
  type: 'text' | 'diff';
  content: string;
}

/** 工具调用输入的解析结果，保留原始字符串供正则匹配等场景使用。 */
export interface IParsedToolCallInput {
  parsed: Record<string, unknown>;
  argsStr: string;
}

const FILE_READ_TOOL_NAMES = new Set([
  'read',
  'codex_read',
  'codex_read_file',
  'codex_view_file',
  'codex_cat_file',
]);

/**
 * 将工具输入或输出格式化为可展示的文本，并标记是否为 JSON。
 */
export function formatToolCallValue(value: unknown): IFormattedToolCallValue {
  if (value === undefined || value === null || value === '') {
    return { content: '', lang: 'text', isJson: false };
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return {
        content: safeJsonString(parsed, null, 2),
        lang: 'json',
        isJson: true,
      };
    } catch {
      return { content: value, lang: 'text', isJson: false };
    }
  }

  const content = safeJsonString(value, null, 2);
  if (!content) {
    return { content: String(value ?? ''), lang: 'text', isJson: false };
  }

  return {
    content,
    lang: 'json',
    isJson: true,
  };
}

/**
 * 判断工具调用是否包含可展示的输入或输出，避免仅为判断状态而格式化 JSON。
 */
export function hasToolCallPayload(toolCall: IToolCall): boolean {
  return (
    (toolCall.input !== undefined &&
      toolCall.input !== null &&
      toolCall.input !== '') ||
    (toolCall.output !== undefined &&
      toolCall.output !== null &&
      toolCall.output !== '')
  );
}

/**
 * 从路径中提取文件名，兼容 Windows 与 Unix 风格路径。
 */
export function extractFileName(path: unknown): string {
  if (typeof path !== 'string' || !path) return '';
  const segments = path.replace(/\\/g, '/').split('/');
  return segments[segments.length - 1] || path;
}

/**
 * 将工具参数归一化为字符串；数组会按空格拼接，其余类型返回空串。
 */
export function toToolCallString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => toToolCallString(item))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

/** 截断工具调用展示文本的参数。 */
export interface ITruncateToolCallTextOptions {
  text: string;
  maxLength: number;
}

/**
 * 截断工具调用展示文本，超出最大长度时附加省略号。
 */
export function truncateToolCallText({
  text,
  maxLength,
}: ITruncateToolCallTextOptions): string {
  const normalizedText = text?.trim?.() || '';
  return normalizedText.length > maxLength
    ? `${normalizedText.slice(0, maxLength)}...`
    : normalizedText;
}

/**
 * 解析工具调用输入，同时保留原始参数字符串。
 */
export function parseToolCallInput(input: unknown): IParsedToolCallInput {
  const argsStr =
    (typeof input === 'string' ? input : JSON.stringify(input || {})) || '{}';
  let parsed: Record<string, unknown> = {};

  try {
    const parsedValue = JSON.parse(argsStr);
    if (
      parsedValue &&
      typeof parsedValue === 'object' &&
      !Array.isArray(parsedValue)
    ) {
      parsed = parsedValue as Record<string, unknown>;
    }
  } catch {
    // 输入不是 JSON 字符串时，保留空对象并继续使用原始字符串。
  }

  return { parsed, argsStr };
}

/**
 * 从文件读取类工具的输入路径推断输出代码语言。
 *
 * 只处理读取工具，避免编辑、命令等工具的状态文本被错误当成代码高亮。
 */
export function inferToolCallOutputLanguage(
  toolCall: IToolCall,
): string | undefined {
  const toolName = toolCall.name?.toLowerCase() || '';
  if (!FILE_READ_TOOL_NAMES.has(toolName)) return undefined;

  const { parsed } = parseToolCallInput(toolCall.input);
  const filePath = parsed.path || parsed.file || parsed.file_path;

  return typeof filePath === 'string'
    ? normalizeCodeLanguage(filePath)
    : undefined;
}

/**
 * 判断当前行是否为统一 diff 的起始行。
 */
function isUnifiedDiffStartLine(line?: string, nextLine?: string): boolean {
  return (
    !!line?.startsWith('diff --git ') ||
    (!!line?.startsWith('--- ') && !!nextLine?.startsWith('+++ '))
  );
}

/**
 * 获取统一 diff 在输出中的起始行位置。
 */
function getUnifiedDiffStartLine(lines: string[]): number {
  return lines.findIndex((line, index) =>
    isUnifiedDiffStartLine(line, lines[index + 1]),
  );
}

/**
 * 将工具输出拆为普通文本段和统一 diff 段，交给代码块渲染。
 *
 * 工具输出可能在日志后附带 `git diff`：日志与差异内容分别保留；没有
 * 识别到 diff 时，整个输出仍按普通文本处理。
 */
export function splitToolCallOutput(output: string): IToolCallOutputSection[] {
  // 末尾换行不影响分段，先去掉以避免 split 生成无意义的空行。
  const normalizedOutput = output?.replace(/\n$/, '') || '';
  const lines = normalizedOutput.split(/\r?\n/);
  // 兼容标准 `diff --git`，以及 `---`、`+++` 连续出现的简化 unified diff。
  const diffStartLine = getUnifiedDiffStartLine(lines);

  // 没有 diff 起始标记时，无需拆分，整段交给普通文本查看器。
  if (diffStartLine < 0) return [{ type: 'text', content: output }];

  // diff 前的日志和 diff 内容分别保留，避免普通日志被当作代码差异渲染。
  const beforeDiff = lines.slice(0, diffStartLine).join('\n');
  const diffContent = lines.slice(diffStartLine).join('\n');
  const sections: IToolCallOutputSection[] = [];

  // 仅加入非空片段，避免输出以 diff 开头或仅有日志时产生空白区块。
  if (beforeDiff?.trim()) sections.push({ type: 'text', content: beforeDiff });
  if (diffContent?.trim())
    sections.push({ type: 'diff', content: diffContent });
  return sections;
}
