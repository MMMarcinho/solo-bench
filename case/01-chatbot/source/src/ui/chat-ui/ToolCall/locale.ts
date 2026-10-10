/**
 * ToolCall 的文案、分类类型与 Codex 解析逻辑。
 */

import type React from 'react';
import type { IToolCall, ToolCategory } from '../typings/tool';
import {
  extractFileName,
  parseToolCallInput,
  toToolCallString,
  truncateToolCallText,
} from './utils';

/**
 * 图标渲染函数:接收要挂的 className(尺寸/颜色由 CSS 控制),返回任意图标节点。
 *
 * 不绑定具体图标库——消费方可返回 lucide、自绘 SVG、图字体或任何来源的节点。
 * `ToolCallIconMap` 按类别分组,每条渲染函数已绑定特定类别,故只需 className。
 */
export type ToolCallIcon = (className: string) => React.ReactNode;

/**
 * 各类别对应的图标集合,可通过 `config.icons` 部分覆盖。
 */
export type ToolCallIconMap = Record<ToolCategory, ToolCallIcon>;

/**
 * 文案生成器的上下文,解析一次后被分类器与文案生成器共享,避免重复 parse。
 */
export interface ToolCallLocaleCtx {
  /** JSON 解析后的 input 参数对象 */
  parsed: Record<string, unknown>;
  /** 原始 args 字符串(apply_patch 正则等需要) */
  argsStr: string;
  /** 当前工具归类结果 */
  category: ToolCategory;
}

/**
 * 工具调用展示文案。所有字段可选,未提供的走内置默认(中文)。
 */
export interface IToolCallLocale {
  /** 单条工具调用展示文案,默认即现状中文逻辑 */
  read?: (toolCall: IToolCall, ctx: ToolCallLocaleCtx) => string;
  edit?: (toolCall: IToolCall, ctx: ToolCallLocaleCtx) => string;
  command?: (toolCall: IToolCall, ctx: ToolCallLocaleCtx) => string;
  web?: (toolCall: IToolCall, ctx: ToolCallLocaleCtx) => string;
  image?: (toolCall: IToolCall, ctx: ToolCallLocaleCtx) => string;
  plan?: (toolCall: IToolCall, ctx: ToolCallLocaleCtx) => string;
  search?: (toolCall: IToolCall, ctx: ToolCallLocaleCtx) => string;
  /** 未识别工具的兜底文案,默认 `已运行 ${name}` */
  fallback?: (toolCall: IToolCall, ctx: ToolCallLocaleCtx) => string;

  /** 聚合摘要文案。各档第二参 streaming 表示该档内是否仍有执行中(未收到 toolResult)的工具,
   *  为 true 时应返回进行态「正在 xxx」,否则完成态。 */
  summary?: {
    command?: (count: number, streaming?: boolean) => string;
    read?: (count: number, streaming?: boolean) => string;
    edit?: (count: number, streaming?: boolean) => string;
    search?: (count: number, streaming?: boolean) => string;
    image?: (count: number, streaming?: boolean) => string;
    web?: (count: number, streaming?: boolean) => string;
    /** other 类摘要,接收工具名 + 计数(内置不再调用,保留兼容) */
    other?: (name: string, count: number, streaming?: boolean) => string;
    /** 摘要各段拼接符,默认 `，` */
    join?: () => string;
  };

  /** codex_* 系列展示文案。第二参 streaming 为 true 时应返回进行态「正在 xxx」 */
  codex?: {
    read?: (file: string | undefined, streaming?: boolean) => string;
    edit?: (file: string | undefined, streaming?: boolean) => string;
    applyPatch?: (file: string | undefined, streaming?: boolean) => string;
    command?: (cmd: string | undefined, streaming?: boolean) => string;
    list?: (path: string | undefined, streaming?: boolean) => string;
    search?: (pattern: string | undefined, streaming?: boolean) => string;
    /** 无 codex 规则命中时的兜底,默认返回原始 name */
    fallback?: (name: string, streaming?: boolean) => string;
  };
}

/** codex 子分类。 */
export enum CodexCategory {
  /** 执行命令类(exec / shell) */
  Command = 'command',
  /** 读取文件类(read / view_file) */
  Read = 'read',
  /** 编辑文件类(write / edit / apply_patch) */
  Edit = 'edit',
  /** 搜索类(search / grep / find_files) */
  Search = 'search',
  /** 列目录类(list_dir / list_files) */
  List = 'list',
}

/**
 * 顶层补充型分类器。返回 undefined 表示“我不认识,走内置规则”。
 */
export type ClassifyFn = (name: string) => ToolCategory | undefined;

/**
 * codex 专属补充型分类器。codex 比 top-level 多一个 `list` 子类。
 *
 * 返回 undefined 表示未识别，回退到内置分类规则。
 */
export type CodexClassifyFn = (name: string) => CodexCategory | undefined;

/**
 * codex 展示解析器。返回 undefined 表示回退内置解析;空串视为有效值。
 */
export type CodexParseFn = (
  name: string,
  input: unknown,
  ctx: {
    parsed: Record<string, unknown>;
    argsStr: string;
    locale: NonNullable<IToolCallLocale['codex']>;
  },
) => string | undefined;

/**
 * ToolCall 配置,通过 props 透传。全部可选,不传时行为与现状逐字节一致。
 */
export interface IToolCallConfig {
  /** 文案覆盖(部分覆盖,内置默认补全) */
  locale?: IToolCallLocale;
  /** 顶层补充型分类器 */
  classify?: ClassifyFn;
  /**
   * 图标覆盖。仅传想替换的类别即可,其余类别回退内置图标。
   * 自定义归类的工具会落入对应类别的图标。
   */
  icons?: Partial<ToolCallIconMap>;
  /** codex 规则 */
  codex?: {
    /** codex 补充型分类器 */
    classify?: CodexClassifyFn;
    /** codex 展示解析(返回 undefined 回退内置) */
    parse?: CodexParseFn;
  };
}

/**
 * codex_* 系列文案默认值。
 */
export const defaultCodexLocale: NonNullable<IToolCallLocale['codex']> = {
  read: (file, streaming) =>
    streaming ? '正在查看文件' : file ? `Read ${file}` : 'Read file',
  edit: (file, streaming) =>
    streaming ? '正在编辑文件' : file ? `Edited ${file}` : 'Edited file',
  applyPatch: (file, streaming) =>
    streaming ? '正在编辑文件' : file ? `Edited ${file}` : 'Applied patch',
  command: (cmd, streaming) =>
    streaming
      ? cmd
        ? `正在运行 ${cmd}`
        : '正在运行命令'
      : cmd
      ? `已运行 ${cmd}`
      : 'Ran command',
  list: (path, streaming) =>
    streaming ? '正在列出目录' : `Listed ${path ?? '.'}`,
  search: (pattern, streaming) =>
    streaming
      ? '正在搜索'
      : pattern
      ? `Searched for ${pattern}`
      : 'Searched files',
  fallback: (name, streaming) => (streaming ? `正在执行 ${name}` : name),
};

type CodexLocale = NonNullable<IToolCallLocale['codex']>;

/**
 * codex 子工具名 → 分类映射表。
 * classify 和 displayName 共用此表,避免重复的字符串匹配。
 */
const SUB_TOOL_CATEGORY: Record<string, CodexCategory> = {
  read: CodexCategory.Read,
  read_file: CodexCategory.Read,
  view_file: CodexCategory.Read,
  cat_file: CodexCategory.Read,
  write: CodexCategory.Edit,
  write_file: CodexCategory.Edit,
  edit_file: CodexCategory.Edit,
  create_file: CodexCategory.Edit,
  apply_patch: CodexCategory.Edit,
  replace_in_file: CodexCategory.Edit,
  exec: CodexCategory.Command,
  exec_command: CodexCategory.Command,
  shell: CodexCategory.Command,
  search: CodexCategory.Search,
  grep: CodexCategory.Search,
  find_files: CodexCategory.Search,
  list_dir: CodexCategory.List,
  list_files: CodexCategory.List,
};

/** edit 类中,除 apply_patch 外共用同一 handler 的子名称。 */
const EDIT_FILE_SUB_TOOLS = [
  'write_file',
  'create_file',
  'edit_file',
  'replace_in_file',
];

/**
 * codex 工具名归类。查 SUB_TOOL_CATEGORY 表，未命中返回 undefined。
 */
export function classifyCodexTool(name: string): CodexCategory | undefined {
  const lowerName = name.toLowerCase();
  if (!lowerName.startsWith('codex_')) return undefined;
  return SUB_TOOL_CATEGORY[lowerName.slice(6)];
}

/**
 * 从 codex exec 命令内容中解析出更细粒度的显示文案。
 * ls/tree → list,find -name → search,find → list,
 * grep/rg → search,cat/head/tail → read,其他 → command。
 */
function resolveExecCommand(
  cmd: string,
  locale: CodexLocale,
  streaming?: boolean,
): string {
  const lowerCmd = cmd.toLowerCase();

  // 列表类
  if (
    lowerCmd.startsWith('ls') ||
    lowerCmd.startsWith('tree') ||
    lowerCmd.includes('--files')
  ) {
    if (lowerCmd.includes('2>/dev/null') || lowerCmd.includes('2> /dev/null')) {
      return locale.command!(
        truncateToolCallText({ text: cmd, maxLength: 60 }),
        streaming,
      );
    }
    return locale.list!('.', streaming);
  }
  // find 命令
  if (lowerCmd.includes('find ') || lowerCmd.startsWith('find')) {
    if (
      lowerCmd.includes('-name') ||
      lowerCmd.includes('-iname') ||
      lowerCmd.includes('-path')
    ) {
      const firstMatch = cmd.match(/-(path|i?name)\s+['"]?([^'"\s]+)/);
      if (firstMatch) {
        return locale.search!(
          truncateToolCallText({ text: firstMatch[2], maxLength: 50 }),
          streaming,
        );
      }
      return locale.search!(undefined, streaming);
    }
    return locale.list!('.', streaming);
  }
  // 搜索类
  if (lowerCmd.includes('grep') || lowerCmd.includes('rg ')) {
    const rgMatch = cmd.match(/(?:rg|grep)\s+(?:-[^\s]+\s+)*['"]?([^'"\s]+)/);
    if (rgMatch) {
      return locale.search!(
        truncateToolCallText({ text: rgMatch[1], maxLength: 50 }),
        streaming,
      );
    }
    return locale.search!(undefined, streaming);
  }
  // 读取文件类命令
  if (
    lowerCmd.startsWith('cat ') ||
    lowerCmd.startsWith('head ') ||
    lowerCmd.startsWith('tail ') ||
    lowerCmd.startsWith('nl ') ||
    lowerCmd.includes('sed ')
  ) {
    const beforePipe = cmd.split('|')[0].trim();
    const parts = beforePipe.split(/\s+/);
    for (let index = parts.length - 1; index >= 1; index -= 1) {
      if (
        !parts[index].startsWith('-') &&
        !parts[index].startsWith("'") &&
        !parts[index].startsWith('"')
      ) {
        return locale.read!(extractFileName(parts[index]), streaming);
      }
    }
    return locale.read!(undefined, streaming);
  }
  // 其他命令
  return locale.command!(
    truncateToolCallText({ text: cmd, maxLength: 60 }),
    streaming,
  );
}

/**
 * 从 codex_ 前缀工具名称和参数中提取人类可读的操作描述。
 * 如 "Read index.tsx"、"Searched for card in ."、"已运行 npm install" 等。
 * streaming 为 true 时各文案返回进行态「正在 xxx」。
 */
export function getCodexToolDisplayName(
  name: string,
  input: unknown,
  locale?: CodexLocale,
  streaming?: boolean,
): string {
  const lowerName = name.toLowerCase();

  if (!lowerName.startsWith('codex_')) return name;

  const mergedLocale: CodexLocale = { ...defaultCodexLocale, ...locale };
  const { parsed, argsStr } = parseToolCallInput(input);
  const sub = lowerName.slice(6);
  const category = SUB_TOOL_CATEGORY[sub];

  // 读取文件类
  if (category === CodexCategory.Read) {
    const filePath = (parsed.path ||
      parsed.file ||
      parsed.file_path ||
      argsStr) as string;
    return mergedLocale.read!(extractFileName(filePath), streaming);
  }

  // 编辑类
  if (category === CodexCategory.Edit) {
    // apply_patch 从 patch 头提取文件名,其余从 path/file 字段提取
    if (sub === 'apply_patch') {
      const patchMatch = argsStr.match(/---\s+(?:a\/)?(.+?)[\s\n]/);
      const file = patchMatch ? extractFileName(patchMatch[1]) : undefined;
      return mergedLocale.applyPatch!(file, streaming);
    }
    if (EDIT_FILE_SUB_TOOLS.includes(sub)) {
      const file = extractFileName(
        parsed.path || parsed.file || parsed.file_path || '',
      );
      return mergedLocale.edit!(file, streaming);
    }
    return mergedLocale.fallback!(name, streaming);
  }

  // 命令执行类
  if (category === CodexCategory.Command) {
    const cmd = (
      toToolCallString(parsed.cmd ?? parsed.command) || argsStr
    ).trim();
    if (!cmd) return mergedLocale.command!(undefined, streaming);
    return resolveExecCommand(cmd, mergedLocale, streaming);
  }

  // 搜索类
  if (category === CodexCategory.Search) {
    const fallbackKey = sub === 'find_files' ? parsed.name : parsed.regex;
    const pattern = toToolCallString(
      parsed.pattern ?? parsed.query ?? fallbackKey,
    );
    return mergedLocale.search!(
      pattern
        ? truncateToolCallText({ text: pattern, maxLength: 50 })
        : undefined,
      streaming,
    );
  }

  // 列表类
  if (category === CodexCategory.List) {
    const path = toToolCallString(parsed.path ?? parsed.dir) || '.';
    const shortPath = path === '.' ? '.' : extractFileName(path) || '.';
    return mergedLocale.list!(shortPath, streaming);
  }

  return mergedLocale.fallback!(name, streaming);
}

/**
 * 完全填满的 locale(所有 key 必有)。mergeLocale 的返回类型。
 */
export type MergedLocale = {
  read: NonNullable<IToolCallLocale['read']>;
  edit: NonNullable<IToolCallLocale['edit']>;
  command: NonNullable<IToolCallLocale['command']>;
  web: NonNullable<IToolCallLocale['web']>;
  image: NonNullable<IToolCallLocale['image']>;
  plan: NonNullable<IToolCallLocale['plan']>;
  search: NonNullable<IToolCallLocale['search']>;
  fallback: NonNullable<IToolCallLocale['fallback']>;
  summary: Required<NonNullable<IToolCallLocale['summary']>>;
  codex: Required<NonNullable<IToolCallLocale['codex']>>;
};

/**
 * 内置默认文案。所有函数体即改造前的现状逻辑(含截断/复数等)。
 */
export const defaultLocale: IToolCallLocale = {
  read: (toolCall, ctx) => {
    const { parsed } = ctx;
    const filePath = (parsed.path ||
      parsed.file ||
      parsed.file_path ||
      '') as string;
    const file = extractFileName(filePath);
    const done = file ? `已查看 ${file}` : '已查看文件';
    // 执行中:正在查看文件(暂不显示文件名,结果未出)
    return toolCall.streaming ? '正在查看文件' : done;
  },
  edit: (toolCall, ctx) => {
    const { parsed } = ctx;
    const filePath = (parsed.path ||
      parsed.file ||
      parsed.file_path ||
      '') as string;
    const file = extractFileName(filePath);
    const done = file ? `已编辑 ${file}` : '已编辑文件';
    return toolCall.streaming ? '正在编辑文件' : done;
  },
  command: (toolCall, ctx) => {
    const { parsed } = ctx;
    const cmd = truncateToolCallText({
      text: toToolCallString(parsed.cmd ?? parsed.command),
      maxLength: 60,
    });
    if (toolCall.streaming) return cmd ? `正在运行 ${cmd}` : '正在运行命令';
    if (!cmd) return '运行命令';
    return `已运行 ${cmd}`;
  },
  web: (toolCall, ctx) => {
    const { parsed } = ctx;
    const url = truncateToolCallText({
      text: toToolCallString(parsed.url ?? parsed.uri),
      maxLength: 50,
    });
    if (toolCall.streaming) return url ? `正在联网搜索 ${url}` : '正在联网搜索';
    if (!url) return '联网搜索';
    return `联网搜索 ${url}`;
  },
  image: (toolCall, ctx) => {
    const { parsed } = ctx;
    const images = parsed.images ?? parsed.urls;
    const count = Array.isArray(images) ? images.length : 1;
    const done = count > 1 ? `查看 ${count} 张图片` : '查看图片';
    return toolCall.streaming
      ? count > 1
        ? `正在查看 ${count} 张图片`
        : '正在查看图片'
      : done;
  },
  plan: (toolCall) => (toolCall.streaming ? '正在更新计划' : '更新计划'),
  search: (toolCall, ctx) => {
    const { parsed } = ctx;
    const pattern = truncateToolCallText({
      text: toToolCallString(
        parsed.pattern ?? parsed.query ?? parsed.regex ?? parsed.name,
      ),
      maxLength: 50,
    });
    if (toolCall.streaming) return pattern ? `正在搜索 ${pattern}` : '正在搜索';
    if (!pattern) return '运行命令';
    return `已搜索 ${pattern}`;
  },
  fallback: (toolCall) =>
    toolCall.streaming
      ? `正在执行 ${toolCall.name || 'unknown'}`
      : `已运行 ${toolCall.name || 'unknown'}`,
  summary: {
    command: (count, streaming) =>
      streaming ? `正在运行 ${count} 条命令` : `已运行 ${count} 条命令`,
    read: (count, streaming) =>
      streaming ? `正在查看 ${count} 个文件` : `查看 ${count} 个文件`,
    edit: (count, streaming) =>
      streaming ? `正在编辑 ${count} 个文件` : `编辑 ${count} 个文件`,
    search: (count, streaming) =>
      streaming ? `正在搜索 ${count} 次` : `搜索 ${count} 次`,
    image: (count, streaming) =>
      streaming ? `正在查看 ${count} 张图片` : `查看 ${count} 张图片`,
    web: (count, streaming) =>
      streaming ? `正在联网搜索 ${count} 次` : `联网搜索 ${count} 次`,
    other: (name, count, streaming) =>
      streaming ? `正在执行 ${name} ${count} 次` : `${name} ${count} 次`,
    join: () => '，',
  },
  codex: defaultCodexLocale,
};

/**
 * 合并调用方传入的 locale 与内置默认,section 级浅合并。
 */
export function mergeLocale(override?: IToolCallLocale): MergedLocale {
  const summary = { ...defaultLocale.summary, ...override?.summary };
  const codex = { ...defaultLocale.codex, ...override?.codex };
  return {
    ...defaultLocale,
    ...override,
    summary,
    codex,
  } as unknown as MergedLocale;
}
