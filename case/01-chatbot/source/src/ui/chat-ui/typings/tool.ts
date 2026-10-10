/**
 * 工具调用的展示分类，用于图标、摘要统计和文案派发。
 *
 * `Plan` 仅影响图标，摘要会被合并到命令分类；未识别的工具归入 `Other`。
 */
export enum ToolCategory {
  /** 执行命令或会话类工具。 */
  Command = 'command',
  /** 读取文件类工具。 */
  Read = 'read',
  /** 编辑文件类工具。 */
  Edit = 'edit',
  /** 查看图片类工具。 */
  Image = 'image',
  /** 联网抓取类工具。 */
  Web = 'web',
  /** 搜索类工具。 */
  Search = 'search',
  /** 更新计划类工具。 */
  Plan = 'plan',
  /** 未识别工具的兜底分类。 */
  Other = 'other',
}

/**
 * 单条工具调用的数据结构。
 */
export interface IToolCall {
  /** 工具调用的唯一标识。 */
  id?: string;
  /** 工具名称。 */
  name?: string;
  /** 工具开始调用的时间。 */
  startedAt?: number | string;
  /** 工具结束调用的时间；执行中可不传。 */
  endedAt?: number | string;
  /** 工具的输入参数。 */
  input?: unknown;
  /** 工具的执行结果。 */
  output?: unknown;
  /** 是否仍在执行中（尚未收到结果）。 */
  streaming?: boolean;
}
