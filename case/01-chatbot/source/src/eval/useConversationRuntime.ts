import type { IMessageItem } from '@/index';
import { MessageChunkType, MessageItemRole } from '@/index';
import type { IConversationChunkMessage } from '@/utils/msg';
import {
  formatConversationChunkMessages,
  mergeChunkToContent,
} from '@/utils/msg';
import { useEffect, useState } from 'react';
import {
  publishSelectedConversation,
  queryConversation,
  subscribeConversation,
} from './mockConversation';

function applyChunk(
  current: IMessageItem[],
  event: IConversationChunkMessage,
): IMessageItem[] {
  const { chunk } = event;
  if (!chunk?.type || chunk.type === MessageChunkType.Status) return current;

  if (chunk.type === MessageChunkType.ToolResult) {
    const [toolResult] = formatConversationChunkMessages([event]);
    return toolResult ? [...current, toolResult] : current;
  }

  const turnId = event.turnId || event.taskId;
  let assistantIndex = -1;
  for (let index = current.length - 1; index >= 0; index -= 1) {
    const message = current[index];
    if (
      message.turnId === turnId &&
      message.role === MessageItemRole.Assistant
    ) {
      assistantIndex = index;
      break;
    }
  }

  if (assistantIndex < 0) {
    const [assistant] = formatConversationChunkMessages([event]);
    return assistant ? [...current, assistant] : current;
  }

  const next = [...current];
  const assistant = next[assistantIndex];
  next[assistantIndex] = {
    ...assistant,
    content: mergeChunkToContent({ content: assistant.content, chunk }),
  };
  return next;
}

/** 统一负责当前会话的历史加载与增量消息订阅。 */
export function useConversationRuntime(conversationId: string) {
  const [messages, setMessages] = useState<IMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    setLoading(true);
    publishSelectedConversation(conversationId);

    queryConversation(conversationId)
      .then((history) => {
        setMessages(history);
      })
      .finally(() => setLoading(false));

    subscribeConversation(conversationId, (event) => {
      if (event.chunk?.type === MessageChunkType.Status) {
        setStreaming(event.chunk?.status !== 'completed');
      }
      setMessages((current) => applyChunk(current, event));
    });
  }, [conversationId]);

  return {
    loading,
    messages,
    setMessages,
    streaming,
  };
}
