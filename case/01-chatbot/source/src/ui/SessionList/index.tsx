import { usePinnedSessions } from '../../hooks/usePinnedSessions';
import {
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
} from '@ant-design/icons';
import { Button, Input, Spin, Tooltip } from 'antd';
import React, { useMemo, useState } from 'react';
import type { ConversationSummary } from '../../types';
import styles from './index.module.less';

interface SessionListProps {
  sessions: ConversationSummary[];
  loading: boolean;
  loaded: boolean;
  agentId: string;
  selectedConversationId?: string | null;
  onSelect: (conversationId: string) => void;
  /** 新建会话按钮点击 */
  onCreate: () => void;
  creating: boolean;
  /** WS 是否就绪(未就绪时按钮禁用) */
  ready: boolean;
}

const formatTime = (gmt?: string) => {
  if (!gmt) return '';
  const d = new Date(gmt);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
};

/** 列表展示标题: 有则用真实标题, 无则兜底「新会话」(而非 convid)。 */
const DEFAULT_SESSION_TITLE = '新会话';

const SessionList: React.FC<SessionListProps> = ({
  sessions,
  loading,
  loaded,
  agentId,
  selectedConversationId,
  onSelect,
  onCreate,
  creating,
  ready,
}) => {
  const [searchText, setSearchText] = useState('');
  // 单实例页面直接使用会话的 deviceId 作为置顶存储维度。
  const { isPinned, togglePin } = usePinnedSessions(
    agentId,
    sessions[0]?.deviceId ?? null,
  );

  // 置顶优先, 再按最近修改倒序
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aPin = isPinned(a.conversationId) ? 1 : 0;
      const bPin = isPinned(b.conversationId) ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      const at = a.gmtModified ? new Date(a.gmtModified).getTime() : 0;
      const bt = b.gmtModified ? new Date(b.gmtModified).getTime() : 0;
      return bt - at;
    });
  }, [sessions, isPinned]);

  // 搜索过滤: 标题 / 会话ID / 创建人
  const filteredSessions = useMemo(() => {
    const kw = searchText.trim().toLowerCase();
    if (!kw) return sortedSessions;
    return sortedSessions.filter((s) => {
      return (
        (s.title ?? '').toLowerCase().includes(kw) ||
        s.conversationId.toLowerCase().includes(kw) ||
        (s.creatorName ?? '').toLowerCase().includes(kw)
      );
    });
  }, [sortedSessions, searchText]);

  const hasPinned = sortedSessions.some((s) => isPinned(s.conversationId));
  const pinnedSessions = filteredSessions.filter((s) =>
    isPinned(s.conversationId),
  );
  const normalSessions = filteredSessions.filter(
    (s) => !isPinned(s.conversationId),
  );

  const renderSession = (session: ConversationSummary) => {
    const active = session.conversationId === selectedConversationId;
    const pinned = isPinned(session.conversationId);
    return (
      <div
        key={session.conversationId}
        className={[
          styles.tab,
          active ? styles.active : '',
          pinned ? styles.pinned : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          className={styles.tabContent}
          onClick={() => onSelect(session.conversationId)}
        >
          <div
            className={styles.tabTitle}
            title={session.title || DEFAULT_SESSION_TITLE}
          >
            <div className={styles.tabPreview}>
              {session.title || DEFAULT_SESSION_TITLE}
            </div>
          </div>
          <div className={styles.tabMeta}>
            {session.creatorName ? <span>{session.creatorName}</span> : null}
            {session.creatorName && session.gmtModified ? (
              <span className={styles.separator}>·</span>
            ) : null}
            <span>{formatTime(session.gmtModified)}</span>
          </div>
        </div>
        <div
          className={styles.pinButton}
          onClick={(e) => {
            e.stopPropagation();
            togglePin(session.conversationId);
          }}
          title={pinned ? '取消置顶' : '置顶会话'}
        >
          {pinned ? (
            <PushpinFilled className={styles.pinIcon} />
          ) : (
            <PushpinOutlined className={styles.pinIcon} />
          )}
        </div>
        {active ? <div className={styles.activeIndicator} /> : null}
      </div>
    );
  };

  return (
    <div className={styles.panel} data-testid="session-list">
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">✦</span>
        <div>
          <strong>Code Agent</strong>
          <span>对话工作区</span>
        </div>
      </div>
      <div className={styles.searchBox}>
        <div className={styles.searchCaption}>最近会话 <span>{sessions.length}</span></div>
        <div className={styles.actionRow}>
          <Input
            placeholder="搜索会话"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            className={styles.searchInput}
            disabled={loading}
          />
          <Tooltip title={ready ? '新建会话' : '设备连接中,请稍后再试'}>
            <Button
              shape="round"
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              loading={creating}
              disabled={!ready}
              onClick={onCreate}
              className={styles.createBtn}
            />
          </Tooltip>
        </div>
      </div>
      <div className={styles.scrollWrapper}>
        <div className={styles.tabList}>
          {loading && !loaded ? (
            <div className={styles.loadingWrap}>
              <Spin size="small" />
              <span>加载会话列表...</span>
            </div>
          ) : null}
          {!loading && filteredSessions.length === 0 ? (
            <div className={styles.loadingWrap}>
              {searchText ? '未匹配到会话' : '暂无会话,点击「+」新建'}
            </div>
          ) : null}
          {hasPinned && pinnedSessions.length > 0 ? (
            <>
              <div className={styles.sectionDivider}>
                <PushpinFilled style={{ fontSize: 12 }} />
                <span>置顶</span>
              </div>
              {pinnedSessions.map(renderSession)}
              {normalSessions.length > 0 ? (
                <div className={styles.sectionDivider}>
                  <span>会话</span>
                </div>
              ) : null}
            </>
          ) : null}
          {normalSessions.map(renderSession)}
        </div>
      </div>
    </div>
  );
};

export default SessionList;
