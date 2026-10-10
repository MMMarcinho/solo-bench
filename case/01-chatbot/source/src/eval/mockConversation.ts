import type { IMessageItem } from '@/index';
import {
  MessageChunkType,
  MessageContentType,
  MessageItemRole,
} from '@/index';
import type {
  IConversationChunkMessage,
  IConversationHistoryMessage,
} from '@/utils/msg';
import { formatConversationHistoryMessage } from '@/utils/msg';

type ChunkListener = (message: IConversationChunkMessage) => void;

interface EvalMetrics {
  activeSubscriptions: number;
  createdSubscriptions: number;
  selectedConversationId: string;
  emitStream: (conversationId?: string) => void;
}

declare global {
  interface Window {
    __CODE_AGENT_EVAL__?: EvalMetrics;
  }
}

type HistoryPayload = Omit<IConversationHistoryMessage, 'message'> & {
  message: Omit<IMessageItem, 'msgId'> & { msgId?: string };
};

const LONG_URL =
  'https://example.com/resources/archive/very-long-path-without-a-natural-break-point?category=conversation&file=project-document-with-a-very-long-file-name.pdf';

function historyRow(
  id: string,
  timestamp: number,
  message: HistoryPayload['message'],
): HistoryPayload {
  return {
    id,
    timestamp: new Date(timestamp).toISOString(),
    message,
  };
}

/**
 * 模拟历史查询返回的持久化记录。外层 id/timestamp 与内层 message
 * 保持两层结构，使数据继续经过协议归一化而不是直接注入组件 props。
 */
function createHistory(
  conversationId: string,
  title: string,
): HistoryPayload[] {
  const baseTime =
    conversationId === 'conversation-a' ? 1786320000000 : 1786323600000;
  const rows: HistoryPayload[] = [];

  for (let index = 0; index < 9; index += 1) {
    const turnId = `${conversationId}-turn-${index}`;
    rows.push(
      historyRow(`${conversationId}-user-${index}`, baseTime + index * 2000, {
        turnId,
        role: MessageItemRole.User,
        sender: { name: index % 2 === 0 ? 'Marco' : '前端同学' },
        content:
          index === 7
            ? `请确认这个长链接可以完整显示或滚动查看：${LONG_URL}`
            : `${title}：第 ${index + 1} 轮问题`,
      }),
    );

    if (index === 6) {
      const toolCallId = `${turnId}-tool-read`;
      rows.push(
        historyRow(
          `${conversationId}-assistant-${index}`,
          baseTime + index * 2000 + 500,
          {
            turnId,
            role: MessageItemRole.Assistant,
            content: [
              {
                type: MessageContentType.Text,
                text: '我先读取相关组件，确认当前布局约束。',
              },
              {
                type: MessageContentType.ToolUse,
                id: toolCallId,
                name: 'read_file',
                input: {
                  path: 'src/components/ChatWorkspace/index.tsx',
                },
              },
            ],
          },
        ),
        historyRow(
          `${conversationId}-tool-result-${index}`,
          baseTime + index * 2000 + 750,
          {
            turnId,
            role: MessageItemRole.ToolResult,
            toolCallId,
            toolName: 'read_file',
            content:
              '已读取 ChatWorkspace：包含会话栏和自适应消息区域。',
          },
        ),
        historyRow(
          `${conversationId}-assistant-${index}-summary`,
          baseTime + index * 2000 + 1000,
          {
            turnId,
            role: MessageItemRole.Assistant,
            content: [
              {
                type: MessageContentType.Text,
                text: `这是 ${title} 的第 ${index + 1} 条回复，用于形成可滚动的历史消息。`,
              },
            ],
          },
        ),
      );
      continue;
    }

    rows.push(
      historyRow(
        `${conversationId}-assistant-${index}`,
        baseTime + index * 2000 + 1000,
        {
          turnId,
          role: MessageItemRole.Assistant,
          content: [
            {
              type: MessageContentType.Text,
              text:
                index === 8
                  ? [
                      '可以，下面保留一段需要横向滚动的代码：',
                      '',
                      '```tsx',
                      "const createMessageIndex = ({ conversationId, messages, attachments }: ConversationContext) => messages.map((message) => `${conversationId}:${message.id}:${attachments.length}`).join('|');",
                      '```',
                      '',
                      '附件：`project-requirements-and-release-notes-with-a-very-long-file-name.pdf`',
                    ].join('\n')
                  : `这是 ${title} 的第 ${index + 1} 条回复，用于形成可滚动的历史消息。`,
            },
          ],
        },
      ),
    );
  }

  return rows;
}

const histories: Record<string, HistoryPayload[]> = {
  'conversation-a': createHistory('conversation-a', '项目进展讨论'),
  'conversation-b': createHistory('conversation-b', '发布问题跟进'),
  'conversation-c': createHistory('conversation-c', '文档与附件确认'),
};

const queryDelay: Record<string, number> = {
  'conversation-a': 1400,
  'conversation-b': 90,
  'conversation-c': 180,
};

const listeners = new Map<string, Set<ChunkListener>>();
let createdSubscriptions = 0;

function publishMetrics(selectedConversationId = '') {
  if (typeof window === 'undefined') return;
  window.__CODE_AGENT_EVAL__ = {
    activeSubscriptions: Array.from(listeners.values()).reduce(
      (total, set) => total + set.size,
      0,
    ),
    createdSubscriptions,
    selectedConversationId,
    emitStream,
  };
}

export function queryConversation(conversationId: string) {
  return new Promise<IMessageItem[]>((resolve) => {
    window.setTimeout(() => {
      resolve(
        histories[conversationId].map((row) =>
          formatConversationHistoryMessage(
            row as unknown as IConversationHistoryMessage,
          ),
        ),
      );
    }, queryDelay[conversationId] ?? 120);
  });
}

export function subscribeConversation(
  conversationId: string,
  listener: ChunkListener,
) {
  const sessionListeners = listeners.get(conversationId) ?? new Set();
  sessionListeners.add(listener);
  listeners.set(conversationId, sessionListeners);
  createdSubscriptions += 1;
  publishMetrics(conversationId);

  return () => {
    sessionListeners.delete(listener);
    if (sessionListeners.size === 0) listeners.delete(conversationId);
    publishMetrics(conversationId);
  };
}

function publishChunk(
  conversationId: string,
  event: IConversationChunkMessage,
) {
  listeners
    .get(conversationId)
    ?.forEach((listener) => listener(structuredClone(event)));
}

/**
 * 不启动本地服务，按真实 chunk 顺序模拟：status -> text -> toolUse ->
 * toolResult -> text -> status。ToolResult 使用 toolCallId 回填对应调用。
 */
export function emitStream(conversationId = 'conversation-b') {
  const turnId = `${conversationId}-stream-turn-${Date.now()}`;
  const toolCallId = `${turnId}-tool-call`;
  const startedAt = Date.now();
  const sequence: Array<{
    delay: number;
    chunk: IConversationChunkMessage['chunk'];
  }> = [
    {
      delay: 0,
      chunk: {
        type: MessageChunkType.Status,
        status: 'started',
        ts: startedAt,
      },
    },
    {
      delay: 80,
      chunk: {
        type: MessageContentType.Text,
        content: '我先检查当前会话区的滚动状态。',
        ts: startedAt + 80,
      },
    },
    {
      delay: 180,
      chunk: {
        type: MessageContentType.ToolUse,
        id: toolCallId,
        name: 'exec_command',
        input: {
          cmd: "rg -n 'scrollToBottom|onScroll' src/components/ChatWorkspace",
        },
        streaming: true,
        ts: startedAt + 180,
      },
    },
    {
      delay: 420,
      chunk: {
        type: MessageChunkType.ToolResult,
        toolCallId,
        toolName: 'exec_command',
        output: [
          'ChatWorkspace/index.tsx:88: scrollToBottom()',
          'MessageList/index.tsx:214: onScroll={handleScroll}',
        ].join('\n'),
        ts: startedAt + 420,
      },
    },
    {
      delay: 560,
      chunk: {
        type: MessageContentType.Text,
        content: '\n已定位自动跟随入口。用户正在查看历史时不应强制滚到底部。',
        ts: startedAt + 560,
      },
    },
    {
      delay: 720,
      chunk: {
        type: MessageChunkType.Status,
        status: 'completed',
        ts: startedAt + 720,
      },
    },
  ];

  sequence.forEach(({ delay, chunk }) => {
    window.setTimeout(() => {
      publishChunk(conversationId, {
        type: 'conversation.chunk',
        taskId: turnId,
        turnId,
        chunk,
      });
    }, delay);
  });
}

export function publishSelectedConversation(conversationId: string) {
  publishMetrics(conversationId);
}
