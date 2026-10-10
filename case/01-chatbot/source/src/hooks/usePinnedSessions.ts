import { useCallback, useEffect, useState } from 'react';

/**
 * 管理钉住的会话列表
 * 数据存储在 localStorage 中，key 格式：pinned-sessions-{agentId}-{instanceId}
 */
export const usePinnedSessions = (
  agentId: string,
  instanceId: string | null,
) => {
  const [pinnedSessionIds, setPinnedSessionIds] = useState<Set<string>>(
    new Set(),
  );

  // 生成 localStorage key
  const getStorageKey = useCallback(() => {
    if (!instanceId) return null;
    return `pinned-sessions-${agentId}-${instanceId}`;
  }, [agentId, instanceId]);

  // 从 localStorage 加载钉住列表
  useEffect(() => {
    const key = getStorageKey();
    if (!key) return;

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        setPinnedSessionIds(new Set(ids));
      }
    } catch (error) {
      console.error('Failed to load pinned sessions:', error);
    }
  }, [getStorageKey]);

  // 保存到 localStorage
  const savePinnedSessions = useCallback(
    (ids: Set<string>) => {
      const key = getStorageKey();
      if (!key) return;

      try {
        localStorage.setItem(key, JSON.stringify(Array.from(ids)));
      } catch (error) {
        console.error('Failed to save pinned sessions:', error);
      }
    },
    [getStorageKey],
  );

  // 切换钉住状态
  const togglePin = useCallback(
    (sessionId: string) => {
      setPinnedSessionIds((prev) => {
        const next = new Set(prev);
        if (next.has(sessionId)) {
          next.delete(sessionId);
        } else {
          next.add(sessionId);
        }
        savePinnedSessions(next);
        return next;
      });
    },
    [savePinnedSessions],
  );

  // 检查是否已钉住
  const isPinned = useCallback(
    (sessionId: string) => {
      return pinnedSessionIds.has(sessionId);
    },
    [pinnedSessionIds],
  );

  return {
    togglePin,
    isPinned,
  };
};
