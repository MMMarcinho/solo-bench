import { CLASS_PREFIX } from '@/constants';
import { isImageFile } from '@/utils/dom';
import { CloseCircleFilled } from 'antd-icons6';
import { UploadFile } from 'antd6';
import cls from 'classnames';
import React, { memo, useState } from 'react';
import { IconFont } from './components/IconFront';
import './index.less';

const classPrefix = `${CLASS_PREFIX}-file-card`;

export interface IFileCardProps extends UploadFile {
  /**
   * @description 自定义类名
   */
  className?: string;
  /**
   * @description 自定义样式
   */
  style?: React.CSSProperties;
  /**
   * @description 是否可删除
   * @default false
   */
  removable?: boolean;
  /**
   * @description 删除回调
   */
  onRemove?: (file: UploadFile) => void;
}

// 文件类型对应icon
export const FILE_TYPE_ICON: Record<string, string> = {
  doc: 'zxb-geshi-doc',
  docx: 'zxb-geshi-doc',
  xls: 'zxb-geshi-excel',
  xlsx: 'zxb-geshi-excel',
  pdf: 'zxb-geshi-pdf',
  txt: 'zxb-geshi-txt',
  ppt: 'zxb-a-geshi-ppt',
  mobi: 'zxb-geshi-mobi',
  cvs: 'zxb-geshi-csv',
  PPT: 'zxb-a-geshi-ppt',
  WORD: 'zxb-geshi-word',
  DOC: 'zxb-geshi-doc',
  DOCX: 'zxb-geshi-doc',
  TXT: 'zxb-geshi-txt',
  CSV: 'zxb-geshi-csv',
  XLS: 'zxb-geshi-excel',
  XLSX: 'zxb-geshi-excel',
  MOBI: 'zxb-geshi-mobi',
  PNG: 'zxb-geshi-tupian',
  JPEG: 'zxb-geshi-tupian',
  JPG: 'zxb-geshi-tupian',
  YUQUE: 'zxb-geshi-yuque',
  YUQUE_LINK: 'zxb-geshi-yuque',
  LINK: 'zxb-lianjie-link',
  DIMA: 'zxb-geshi-Dima',
};

// 获取文件类型图标
const getFileIconType = (fileType?: string, fileName?: string) => {
  const type = fileType?.toLowerCase() || '';
  const name = fileName?.toLowerCase() || '';
  let finalType;

  if (type.includes('pdf') || name.endsWith('.pdf')) {
    finalType = 'pdf';
  }
  if (type.includes('word') || name.endsWith('.doc')) {
    finalType = 'doc';
  }
  if (name.endsWith('.docx')) {
    finalType = 'docx';
  }
  if (
    type.includes('excel') ||
    type.includes('sheet') ||
    name.endsWith('.xls')
  ) {
    finalType = 'xls';
  }
  if (name.endsWith('.xlsx')) {
    finalType = 'xlsx';
  }
  if (
    type.includes('powerpoint') ||
    type.includes('presentation') ||
    name.endsWith('.ppt') ||
    name.endsWith('.pptx')
  ) {
    finalType = 'ppt';
  }
  if (type.includes('text') || name.endsWith('.txt')) {
    finalType = 'txt';
  }
  if (
    type.includes('image') ||
    name.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/)
  ) {
    finalType = 'image';
  }
  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    finalType = 'markdown';
  }

  return finalType;
};

// 格式化文件类型
const formatFileType = (type?: string, fileName?: string) => {
  const typeStr = type?.toLowerCase() || '';
  const name = fileName?.toLowerCase() || '';

  if (typeStr.includes('pdf') || name.endsWith('.pdf')) {
    return 'PDF 文件';
  }
  if (
    typeStr.includes('word') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx')
  ) {
    return 'Word 文件';
  }
  if (
    typeStr.includes('excel') ||
    typeStr.includes('sheet') ||
    name.endsWith('.xls') ||
    name.endsWith('.xlsx')
  ) {
    return 'Excel 文件';
  }
  if (
    typeStr.includes('powerpoint') ||
    typeStr.includes('presentation') ||
    name.endsWith('.ppt') ||
    name.endsWith('.pptx')
  ) {
    return 'PPT 文件';
  }
  if (typeStr.includes('text') || name.endsWith('.txt')) {
    return 'TXT 文件';
  }
  if (typeStr.includes('zip') || name.endsWith('.zip')) {
    return 'ZIP 文件';
  }
  if (typeStr.includes('rar') || name.endsWith('.rar')) {
    return 'RAR 文件';
  }
  if (typeStr.includes('7z') || name.endsWith('.7z')) {
    return '7Z 文件';
  }
  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    return 'Markdown 文件';
  }
  if (typeStr.includes('image')) {
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'JPG 文件';
    if (name.endsWith('.png')) return 'PNG 文件';
    if (name.endsWith('.gif')) return 'GIF 文件';
    if (name.endsWith('.bmp')) return 'BMP 文件';
    if (name.endsWith('.svg')) return 'SVG 文件';
    if (name.endsWith('.webp')) return 'WEBP 文件';
    return '图片文件';
  }

  return '未知类型';
};

// 格式化文件大小
const formatFileSize = (size?: number) => {
  if (!size) return '';
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)}KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(0)}MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(0)}GB`;
};

export const FileCard = memo((props: IFileCardProps) => {
  const {
    className,
    style,
    name,
    type,
    size,
    status,
    thumbUrl,
    url,
    percent,
    removable = true,
    onRemove,
  } = props || {};

  const [isHovered, setIsHovered] = useState(false);
  const isUploading = status === 'uploading';
  const isError = status === 'error';

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(props);
  };

  // 渲染预览
  const renderPreview = () => {
    // 如果是图片且有预览图，显示图片预览
    if (isImageFile(props) && (thumbUrl || url)) {
      return (
        <div
          className={`${classPrefix}__preview ${classPrefix}__preview--image`}
        >
          <img src={thumbUrl || url} alt={name} />
        </div>
      );
    }

    const fileType = getFileIconType(type, name) as string;
    // 否则显示文件类型图标
    return (
      <div className={`${classPrefix}__preview ${classPrefix}__preview--icon`}>
        <IconFont type={FILE_TYPE_ICON[fileType]} />
      </div>
    );
  };

  // 渲染描述
  const renderDescription = () => {
    if (isUploading) {
      return (
        <div
          className={`${classPrefix}__description ${classPrefix}__description--uploading`}
        >
          <span>文件上传中</span>
        </div>
      );
    }
    if (isError) {
      return (
        <div
          className={`${classPrefix}__description ${classPrefix}__description--error`}
        >
          <span>文件上传失败</span>
        </div>
      );
    }
    return (
      <div className={`${classPrefix}__description`}>
        <span className={`${classPrefix}__description-type`}>
          {formatFileType(type, name)}
        </span>
        <span className={`${classPrefix}__description-size`}>
          {formatFileSize(size)}
        </span>
      </div>
    );
  };

  return (
    <div
      className={cls(classPrefix, className, {
        [`${classPrefix}--error`]: isError,
        [`${classPrefix}--uploading`]: isUploading,
        [`${classPrefix}--removable`]: removable,
      })}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!!isUploading && !!percent && (
        <div
          className={`${classPrefix}--uploading__pct`}
          style={{ width: `${percent}%` }}
        />
      )}
      {renderPreview()}
      <div className={`${classPrefix}__content`}>
        <div className={`${classPrefix}__title`}>{name || '未命名文件'}</div>
        {renderDescription()}
      </div>
      {removable && isHovered && (
        <CloseCircleFilled
          className={`${classPrefix}__remove-icon`}
          onClick={handleRemove}
        />
      )}
    </div>
  );
});
