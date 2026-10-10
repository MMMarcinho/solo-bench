import { ToolCategory } from '../typings/tool';

/**
 * 根据内置工具名称返回对应的展示分类。
 *
 * `codex_*` 工具由 ToolCall 内部的专用解析逻辑处理，因此这里不参与归类。
 */
export function builtinClassify(name: string): ToolCategory | undefined {
  const normalizedName = name.toLowerCase();

  if (normalizedName === 'read') return ToolCategory.Read;
  if (normalizedName === 'edit' || normalizedName === 'write')
    return ToolCategory.Edit;
  if (
    normalizedName === 'exec' ||
    normalizedName === 'session' ||
    normalizedName.startsWith('session_') ||
    normalizedName.startsWith('sessions_') ||
    normalizedName === 'codex_exec'
  ) {
    return ToolCategory.Command;
  }

  if (normalizedName === 'web_fetch') return ToolCategory.Web;
  if (normalizedName === 'image') return ToolCategory.Image;
  if (normalizedName === 'update_plan') return ToolCategory.Plan;
  if (
    normalizedName === 'search' ||
    normalizedName === 'grep' ||
    normalizedName === 'find_files'
  ) {
    return ToolCategory.Search;
  }

  return undefined;
}
