import type { IMessageItem, IMessageListRef } from '@/index';
import {
  ChatSender,
  CLASS_PREFIX,
  MessageItemRole,
  MessageList,
} from '@/index';
import '@/ConversationLayout/index.less';
import React, { useLayoutEffect, useRef, useState } from 'react';
import styles from './App.module.less';
import { useConversationRuntime } from './eval/useConversationRuntime';
import userAvatarUrl from './assets/user-avatar.png';
import agentAvatarUrl from './assets/assistant-avatar.png';
import type { ConversationSummary } from './types';
import layoutStyles from './ui/layout.module.less';
import SessionList from './ui/SessionList';

const AGENT_ID = 'chatbot-demo-agent';

const sessions: ConversationSummary[] = [
  {
    conversationId: 'conversation-a',
    agentId: AGENT_ID,
    deviceId: 'device-demo',
    title: '项目进展讨论',
    creatorName: 'Marco',
    gmtModified: '2026-08-10T15:32:00+08:00',
  },
  {
    conversationId: 'conversation-b',
    agentId: AGENT_ID,
    deviceId: 'device-demo',
    title: '发布问题跟进',
    creatorName: '前端同学',
    gmtModified: '2026-08-10T15:20:00+08:00',
  },
  {
    conversationId: 'conversation-c',
    agentId: AGENT_ID,
    deviceId: 'device-demo',
    title: '文档与附件确认',
    creatorName: 'Marco',
    gmtModified: '2026-08-10T14:48:00+08:00',
  },
];

const conversationClass = `${CLASS_PREFIX}-ai-conversation`;

function App() {
  const [selectedConversationId, setSelectedConversationId] =
    useState('conversation-a');
  const [senderValue, setSenderValue] = useState('');
  const messageListRef = useRef<IMessageListRef>(null);
  const { loading, messages, setMessages, streaming } = useConversationRuntime(
    selectedConversationId,
  );
  const selectedSession = sessions.find(
    (session) => session.conversationId === selectedConversationId,
  );

  useLayoutEffect(() => {
    messageListRef.current?.scrollToBottom();
  }, [messages]);

  function handleSend(value: string) {
    const text = value.trim();
    if (!text) return;
    const message: IMessageItem = {
      msgId: `local-${Date.now()}`,
      turnId: `local-turn-${Date.now()}`,
      timestamp: Date.now(),
      role: MessageItemRole.User,
      sender: { name: 'Marco' },
      content: text,
    };
    setMessages((current) => [...current, message]);
    setSenderValue('');
  }

  return (
    <main className={styles.viewport} data-testid="eval-viewport">
      <div className={layoutStyles.root}>
        <SessionList
          sessions={sessions}
          loading={false}
          loaded
          agentId={AGENT_ID}
          selectedConversationId={selectedConversationId}
          onSelect={setSelectedConversationId}
          onCreate={() => undefined}
          creating={false}
          ready
        />
        <div className={layoutStyles.conversationWrap}>
          <header className={styles.desktopHeader}>
            <div className={styles.desktopHeaderIdentity}>
              <span className={styles.desktopHeaderEyebrow}>WORKSPACE / CONVERSATION</span>
              <h1>{selectedSession?.title ?? '会话'}</h1>
              <p>与 AI Code Agent 的本地演示会话</p>
            </div>
            <div className={styles.desktopHeaderStatus} aria-label="离线演示环境">
              <span className={styles.statusDot} />
              本地 Mock
            </div>
          </header>
          <section
            className={conversationClass}
            data-testid="conversation"
            data-conversation-id={selectedConversationId}
            data-loading={loading ? 'true' : 'false'}
          >
            <MessageList
              ref={messageListRef}
              className={`${conversationClass}__message-list`}
              data={messages}
              agentName="AI Code Agent"
              agentAvatarUrl={agentAvatarUrl}
              userAvatarUrl={userAvatarUrl}
              loading={loading}
              showAiTyping={streaming}
            />
            <ChatSender
              className={`${conversationClass}__sender`}
              value={senderValue}
              onChange={setSenderValue}
              onSend={handleSend}
              placeholder="请输入..."
            />
          </section>
        </div>
      </div>
    </main>
  );
}

export default App;
