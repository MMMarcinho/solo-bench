import type {
  IMessageContentData,
  IMessageContentToolUseData,
} from '@/MessageContent';
import type { IMessageItem } from '@/MessageItem';
import {
  MessageChunkType,
  MessageContentType,
  MessageItemRole,
} from '@/typings';

export interface IConversationChunkMessage {
  type?: string;
  taskId?: string;
  turnId?: string;
  chunk?: {
    type?: string;
    content?: string;
    text?: string;
    message?: string;
    output?: unknown;
    id?: string;
    name?: string;
    input?: unknown;
    toolName?: string;
    toolCallId?: string;
    ts?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface IConversationHistoryMessage {
  id: string;
  timestamp: string;
  message: IMessageItem[];
}

/**
 * 从名称中提取首个可见字符，用于生成文字头像。
 */
export function getAvatarInitial(name?: string): string {
  return Array.from(name?.trim() || '')[0] || '🤖';
}

interface IMergeChunkToContentOptions {
  /**
   * 当前消息内容
   */
  content?: IMessageItem['content'];
  /**
   * 对话流返回的增量内容
   */
  chunk?: IConversationChunkMessage['chunk'];
}

interface IUpsertToolResultOptions {
  /**
   * 当前消息内容列表
   */
  content: IMessageContentData[];
  /**
   * 工具结果 chunk
   */
  chunk: NonNullable<IConversationChunkMessage['chunk']>;
}

type IMessageContentTextWithMeta = IMessageContentData & {
  /**
   * chunk 原始类型，用于区分普通文本和错误提示。
   */
  chunkType?: string;
};

/** 去除 [[reply_to_current]] / [[reply_to:<id>]] 这类回复定位标记。 */
export function stripReplyToMarkers(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[\[reply_to_current\]\]/g, '')
    .replace(/\[\[reply_to:[^\]]*\]\]/g, '');
}

/** 去除消息中的 meta 信息块 */
export function stripMetaBlocks(text: string): string {
  if (typeof text !== 'string') return text;

  const cleaned = stripReplyToMarkers(text);

  // 如果存在 Sender (untrusted metadata) 块，只保留最后一个块之后的正文
  const senderBlockRe =
    /Sender\s*\(untrusted metadata\):\s*```json\s*[\s\S]*?```/g;
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = senderBlockRe.exec(cleaned)) !== null) {
    lastEnd = m.index + m[0].length;
  }
  const body = lastEnd >= 0 ? cleaned.slice(lastEnd) : cleaned;

  return body
    .replace(/<userInfo>[\s\S]*?<\/userInfo>\n*/g, '')
    .replace(
      /\n*Conversation info\s*\(untrusted metadata\):\s*```json[\s\S]*?```/g,
      '',
    )
    .replace(
      /\n*Replied message\s*\(untrusted,\s*for context\):\s*```json[\s\S]*?```/g,
      '',
    )
    .replace(
      /\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+GMT[+-]\d+\]\s*/g,
      '',
    )
    .trim();
}

/**
 * 判断消息内容项是否是工具调用。
 */
function isToolUseContent(
  item: IMessageContentData,
): item is IMessageContentToolUseData {
  return item?.type === MessageContentType.ToolUse;
}

export function formatConversationHistoryMessage(
  data: IConversationHistoryMessage,
) {
  const message = data?.message as unknown as IMessageItem;
  const timestamp = data?.timestamp;
  const content = Array.isArray(message?.content)
    ? message.content.map((item) => {
        if (!isToolUseContent(item) || item.startedAt !== undefined) {
          return item;
        }

        // 历史消息已无法获得原始 chunk，使用落库消息时间作为工具开始时间。
        return { ...item, startedAt: timestamp };
      })
    : message?.content;

  return {
    ...message,
    content,
    msgId: data?.id,
    timestamp,
    // 历史 ToolResult 使用落库消息时间作为工具结束时间。
    endedAt:
      message?.role === MessageItemRole.ToolResult
        ? message?.endedAt ?? timestamp
        : message?.endedAt,
  } as unknown as IMessageItem;
}

/**
 * 找到工具结果要回填的工具调用位置。
 */
function findToolUseIndex(options: IUpsertToolResultOptions) {
  const { content, chunk } = options;

  if (chunk?.toolCallId) {
    const matchedIndex = content.findIndex((item) => {
      return isToolUseContent(item) && item.id === chunk.toolCallId;
    });

    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }

  for (let index = content.length - 1; index >= 0; index -= 1) {
    const item = content[index];

    if (isToolUseContent(item)) {
      return index;
    }
  }

  return -1;
}

/**
 * 将工具结果回填到对应工具调用的 output 上。
 */
function upsertToolResult(
  options: IUpsertToolResultOptions,
): IMessageContentData[] {
  const { content, chunk } = options;
  const toolUseIndex = findToolUseIndex(options);
  const output = chunk?.output ?? chunk?.content ?? chunk?.text ?? '';

  if (toolUseIndex < 0) {
    return [
      ...content,
      {
        type: MessageContentType.ToolUse,
        id: chunk?.toolCallId,
        name: chunk?.toolName,
        endedAt: chunk?.ts,
        output,
        streaming: false,
      } as IMessageContentToolUseData,
    ];
  }

  const nextContent = [...content];
  const toolUse = nextContent[toolUseIndex] as IMessageContentToolUseData;

  nextContent[toolUseIndex] = {
    ...toolUse,
    endedAt: chunk?.ts,
    output,
    streaming: false,
  };

  return nextContent;
}

/**
 * 将消息内容统一转为内容块列表，便于后续合并 chunk。
 */
function normalizeContentList(content?: IMessageItem['content']) {
  if (Array.isArray(content)) {
    return content;
  }

  if (content) {
    return [
      {
        type: MessageContentType.Text,
        text: content,
      },
    ] as IMessageContentData[];
  }

  return [];
}

/**
 * 将工具结果转成 ToolResult 消息可承载的字符串内容。
 */
function formatToolResultContent(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * 提取普通文本或错误 chunk 中可展示的文案。
 */
function getChunkDisplayText(
  chunk?: IConversationChunkMessage['chunk'],
): string | undefined {
  return chunk?.content ?? chunk?.text ?? chunk?.message;
}

/**
 * 将对话流 chunk 转成消息组件支持的内容块。
 */
function normalizeChunkToContent(
  chunk?: IConversationChunkMessage['chunk'],
): IMessageContentData | undefined {
  const chunkType = chunk?.type;
  const chunkText = getChunkDisplayText(chunk);

  if (
    !chunkType ||
    chunkType === MessageContentType.Text ||
    chunkType === MessageChunkType.Error
  ) {
    if (!chunkText) {
      return undefined;
    }

    return {
      type: MessageContentType.Text,
      text: chunkText,
      chunkType:
        chunkType === MessageChunkType.Error
          ? MessageChunkType.Error
          : undefined,
    } as IMessageContentData;
  }

  if (chunkType === MessageContentType.ToolUse) {
    return {
      ...chunk,
      type: MessageContentType.ToolUse,
      startedAt: chunk?.ts,
    } as IMessageContentData;
  }

  return undefined;
}

/**
 * 合并流式 chunk，连续文本直接追加，其它内容块追加到末尾。
 */
export function mergeChunkToContent(
  options: IMergeChunkToContentOptions,
): IMessageContentData[] {
  const { content, chunk } = options;
  const contentList = normalizeContentList(content);

  if (!chunk?.type || chunk?.type === MessageChunkType.Status) {
    return contentList;
  }

  if (chunk?.type === MessageChunkType.ToolResult) {
    return upsertToolResult({
      content: contentList,
      chunk,
    });
  }

  const nextChunk = normalizeChunkToContent(chunk);

  if (!nextChunk) {
    return contentList;
  }

  const nextContent = [...contentList];
  const lastContent = nextContent[nextContent.length - 1];

  if (chunk?.type === MessageChunkType.Error) {
    const lastErrorIndex = nextContent.findIndex((item) => {
      return (
        (item as IMessageContentTextWithMeta)?.chunkType ===
        MessageChunkType.Error
      );
    });

    // 重连错误会连续下发多条，同一轮次只保留最后一条给用户看。
    if (lastErrorIndex >= 0) {
      nextContent[lastErrorIndex] = nextChunk;
      return nextContent;
    }

    nextContent.push(nextChunk);
    return nextContent;
  }

  // 类型相同，都为 text
  if (
    lastContent?.type === MessageContentType.Text &&
    nextChunk.type === MessageContentType.Text
  ) {
    nextContent[nextContent.length - 1] = {
      ...lastContent,
      text: `${lastContent?.text || ''}${nextChunk?.text || ''}`,
    };
    return nextContent;
  }

  // 类型不同
  nextContent.push(nextChunk);

  return nextContent;
}

/**
 * 根据对话流 chunk 列表生成 MessageList 可直接消费的消息流。
 */
export function formatConversationChunkMessages(
  data?: IConversationChunkMessage[],
): IMessageItem[] {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const msgItems: IMessageItem[] = [];

  data.forEach((item, index) => {
    const { chunk } = item || {};

    if (!chunk?.type || chunk?.type === MessageChunkType.Status) {
      return;
    }

    if (chunk?.type === MessageChunkType.ToolResult) {
      const turnId = item?.turnId || item?.taskId || `chunk-turn-${index}`;

      // ToolResult 先作为独立消息进入列表，后续由 MessageList 合并到上方 ToolCall。
      msgItems.push({
        msgId: `${turnId}-tool-result-${chunk?.toolCallId || index}`,
        turnId,
        role: MessageItemRole.ToolResult,
        timestamp: chunk?.ts || Date.now(),
        endedAt: chunk?.ts,
        toolCallId: chunk?.toolCallId,
        toolName: chunk?.toolName,
        content: formatToolResultContent(
          chunk?.output ?? chunk?.content ?? chunk?.text,
        ),
      });
      return;
    }

    const turnId = item?.turnId || item?.taskId || `chunk-turn-${index}`;
    let msgItem = msgItems.find((msg) => msg?.turnId === turnId);

    if (!msgItem) {
      msgItem = {
        msgId: turnId,
        turnId,
        role: MessageItemRole.Assistant,
        timestamp: chunk?.ts || Date.now(),
        content: [],
      };
      msgItems.push(msgItem);
    }

    msgItem.content = mergeChunkToContent({
      content: msgItem.content,
      chunk,
    });
  });

  return msgItems;
}

/**
 * 找最后一条消息
 * @param msgItems
 * @returns
 */
export function findLastMessage(
  msgItems: IMessageItem[],
  matcher: (msg: IMessageItem) => boolean,
) {
  if (!Array.isArray(msgItems)) {
    return undefined;
  }

  for (let index = msgItems.length - 1; index >= 0; index -= 1) {
    const msg = msgItems[index];

    if (matcher?.(msg) && msg?.msgId) {
      return msg;
    }
  }

  return undefined;
}
