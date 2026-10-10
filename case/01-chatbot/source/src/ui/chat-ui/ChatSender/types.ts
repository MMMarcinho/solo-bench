import type { AttachmentsProps } from '@ant-design/x';
import type { UploadFile } from 'antd6';
import type { ReactNode } from 'react';

export interface IUploadFile extends UploadFile {
  fileUrl?: string;
}

export interface IChatSenderUploadProps {
  /**
   * 上传接口地址，与 onUpload 二选一。
   */
  action?: string;
  headers?: Record<string, any>;
  name?: string;
  /**
   * 根据 action 接口返回值得到上传文件 OSS 地址。
   */
  getFileUrl?: (resp?: any) => string;
  /**
   * 自定义上传处理函数，优先于 action。
   */
  onUpload?: (
    file: File,
    onProgress: (percent: number) => void,
  ) => Promise<string>;
  prefix?: ReactNode;
  suffix?: ReactNode;
  onRemove?: (file: UploadFile) => void;
  /**
   * 拖拽上传的放置容器，不传时使用 ChatSender 根节点。
   */
  getDropContainer?: () => HTMLElement | null;
  /**
   * 拖拽上传蒙层的提示内容。
   */
  placeholder?: AttachmentsProps['placeholder'];
}
