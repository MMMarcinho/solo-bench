import type { CSSProperties } from 'react';

export type FileType =
  | 'md'
  | 'markdown'
  | 'json'
  | 'js'
  | 'jsx'
  | 'ts'
  | 'tsx'
  | 'css'
  | 'less'
  | 'scss'
  | 'html'
  | 'xml'
  | 'yaml'
  | 'yml'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'sql'
  | 'shell'
  | 'bash'
  | 'dockerfile'
  | 'text'
  | 'c'
  | 'cpp'
  | 'ruby'
  | 'kotlin'
  | 'csharp'
  | 'php'
  | 'swift'
  | 'r'
  | 'lua'
  | 'perl'
  | 'ini'
  | 'toml'
  | 'conf';

export const EXT_TO_FILE_TYPE: Record<string, FileType> = {
  '.md': 'md',
  '.markdown': 'markdown',
  '.json': 'json',
  '.js': 'js',
  '.jsx': 'jsx',
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.css': 'css',
  '.less': 'less',
  '.scss': 'scss',
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yml',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'bash',
  '.dockerfile': 'dockerfile',
  '.txt': 'text',
  '.log': 'text',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.rb': 'ruby',
  '.kt': 'kotlin',
  '.cs': 'csharp',
  '.php': 'php',
  '.swift': 'swift',
  '.r': 'r',
  '.lua': 'lua',
  '.pl': 'perl',
  '.ini': 'ini',
  '.toml': 'toml',
  '.conf': 'conf',
  '.env': 'text',
  '.gitignore': 'text',
};

export const FILE_TYPE_TO_LANGUAGE_MAP: Record<FileType, string> = {
  bash: 'bash',
  c: 'c',
  conf: 'text',
  cpp: 'cpp',
  csharp: 'csharp',
  css: 'css',
  dockerfile: 'docker',
  go: 'go',
  html: 'markup',
  ini: 'ini',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsx: 'jsx',
  kotlin: 'kotlin',
  less: 'less',
  lua: 'lua',
  markdown: 'markdown',
  md: 'markdown',
  perl: 'perl',
  php: 'php',
  python: 'python',
  r: 'r',
  ruby: 'ruby',
  rust: 'rust',
  scss: 'scss',
  shell: 'bash',
  sql: 'sql',
  swift: 'swift',
  text: 'text',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'tsx',
  xml: 'markup',
  yaml: 'yaml',
  yml: 'yaml',
};

export const LANGUAGE_ALIAS_MAP: Record<string, string> = {
  cjs: 'javascript',
  console: 'bash',
  dockerfile: 'docker',
  h: 'c',
  hpp: 'cpp',
  html: 'markup',
  js: 'javascript',
  mjs: 'javascript',
  node: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  xml: 'markup',
  yml: 'yaml',
};

export const CODE_HIGHLIGHTER_STYLE: CSSProperties = {
  background: 'transparent',
  backgroundColor: 'transparent',
  borderRadius: 0,
  margin: 0,
  padding: 0,
};

/**
 * 将文件路径、扩展名或语言别名归一化为 react-syntax-highlighter 可识别的语言。
 */
export function normalizeCodeLanguage(lang?: string): string | undefined {
  const language = lang?.trim().split(/\s+/)[0].toLowerCase();

  if (!language) {
    return undefined;
  }

  const extension = language.startsWith('.')
    ? language
    : language.match(/(?:^|\/)(\.[^./]+)$/)?.[1] ||
      language.match(/(\.[^./]+)$/)?.[1];
  const fileType = extension ? EXT_TO_FILE_TYPE[extension] : undefined;

  if (fileType) {
    return FILE_TYPE_TO_LANGUAGE_MAP[fileType];
  }

  if (language in FILE_TYPE_TO_LANGUAGE_MAP) {
    return FILE_TYPE_TO_LANGUAGE_MAP[language as FileType];
  }

  return LANGUAGE_ALIAS_MAP[language] || language;
}
