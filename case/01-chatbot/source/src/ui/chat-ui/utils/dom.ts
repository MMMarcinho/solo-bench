import copyToClipboard from 'copy-to-clipboard';

export function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // 传入一个参数对象即可得到基于该参数对象的文本内容
    reader.readAsDataURL(file);
    reader.onload = function (e) {
      resolve(e?.target?.result as string);
    };
    reader.onerror = function (e) {
      reject(e);
    };
  });
}

export function isImageFile(file: Partial<File>) {
  const { type, name } = file || {};
  return (
    type?.includes('image') || name?.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/)
  );
}

export enum EUploadFileStatus {
  error = 'error',
  done = 'done',
  uploading = 'uploading',
  removed = 'removed',
}

export function simpleHTMLDecode(s: string) {
  return s
    .replace(/^"(.*)"$/, '$1') // 去掉外层引号（若有）
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

export function getRootFontSize() {
  const root = document.documentElement;
  const fontSizeStr = window
    .getComputedStyle(root)
    .getPropertyValue('font-size'); // e.g. "16px"
  return parseFloat(fontSizeStr);
}

/**
 * 使用 copy-to-clipboard 将指定文本写入剪贴板，并返回复制结果。
 */
export function copyText(text: string): Promise<boolean> {
  return Promise.resolve(copyToClipboard(text));
}

/**
 * 判断拖拽事件携带的数据是否包含文件。
 * dataTransfer.types 在 dragenter/dragover期间可用，
 * 文件拖拽时 types 中会包含 'Files'。
 */
export function isDragWithFiles(event: React.DragEvent | DragEvent): boolean {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  // types 是 DOMStringList 或数组，统一处理
  return Array.from(types).includes('Files');
}
