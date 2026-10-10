import { FileCard } from '@/FileCard';
import { CLASS_PREFIX } from '@/constants';
import { CloseCircleFilled } from 'antd-icons6';
import { Sender } from '@ant-design/x';
import { useMemoizedFn } from 'ahooks';
import type { UploadFile } from 'antd6';
import React, { memo } from 'react';
import {
  useAttachmentActions,
  useAttachmentFileList,
} from '../AttachmentProvider';

/**
 * 输入框头部只订阅附件展示状态，避免上传进度触发整个 Sender 重渲染。
 */
const classPrefix = `${CLASS_PREFIX}-chat-sender`;
const HEADER_STYLES = {
  content: {
    padding: '12px 12px 8px',
    display: 'flex',
    gap: 8,
  },
} as const;

/**
 * 输入框头部属性。
 */
interface IChatSenderHeaderProps {
  quote: string;
  onQuoteRemove?: (quote: string) => void;
}

/**
 * 引用预览属性。
 */
interface IQuotePreviewProps {
  quote: string;
  onRemove?: (quote: string) => void;
}

/**
 * 展示文本引用，删除图标通过 CSS hover 控制，避免鼠标移动触发状态更新。
 */
const QuotePreview = memo((props: IQuotePreviewProps) => {
  const { quote, onRemove } = props;
  if (!quote) {
    return null;
  }

  return (
    <div className={`${classPrefix}__quote-wrapper`}>
      <div className={`${classPrefix}__quote`}>
        <div className={`${classPrefix}__quote--scroll`}>{quote}</div>
      </div>
      <CloseCircleFilled
        className={`${classPrefix}__quote-remove-icon`}
        tabIndex={0}
        role="button"
        aria-label="删除引用"
        onClick={(event) => {
          event.stopPropagation();
          onRemove?.(quote);
        }}
      />
    </div>
  );
});

QuotePreview.displayName = 'QuotePreview';

/**
 * 仅订阅附件列表，上传进度变化时只刷新头部和发生变化的文件卡片。
 */
function InnerChatSenderHeader(props: IChatSenderHeaderProps) {
  const { quote, onQuoteRemove } = props;
  const fileList = useAttachmentFileList();
  const attachmentActions = useAttachmentActions();
  const hasContent = fileList.length > 0 || quote.length > 0;
  /**
   * 将文件卡片删除操作交给附件状态容器统一处理。
   */
  const handleRemove = useMemoizedFn((file: UploadFile) => {
    attachmentActions?.removeFile(file);
  });

  return (
    <Sender.Header
      styles={HEADER_STYLES}
      open={hasContent}
      closable={false}
      forceRender
    >
      {fileList.map((file) => (
        <FileCard key={file.uid} {...file} onRemove={handleRemove} />
      ))}
      <QuotePreview quote={quote} onRemove={onQuoteRemove} />
    </Sender.Header>
  );
}

export const ChatSenderHeader = memo(InnerChatSenderHeader);
