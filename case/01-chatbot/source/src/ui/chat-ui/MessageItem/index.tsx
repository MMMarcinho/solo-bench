import { getCopyText, IMessageContentData } from '@/MessageContent';
import { copyText } from '@/utils/dom';
import { EllipsisOutlined, ExclamationCircleFilled } from 'antd-icons6';
import { Dropdown, DropdownProps } from 'antd6';
import cls from 'classnames';
import { Check, Copy } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { CLASS_PREFIX, EElementPosType } from '../constants';
import { MessageItemRole } from '../typings';
import { formatDate } from '../utils/date';
import './index.less';

const classPrefix = `${CLASS_PREFIX}-message-item`;

export type IMessageRenderData = {
  data: IMessageItem;
  element: React.ReactNode;
  ext?: Record<string, any>;
  /**
   * 在哪里展示, 默认 user
   */
  elementPosType?: EElementPosType;
};

export interface IMessageRender {
  (
    props: IMessageRenderData,
    next: (props: IMessageRenderData) => IMessageRenderData,
  ): IMessageRenderData;
}

export interface ICustomMessageData {
  templateId: string;
  kind: string;
  outTrackId: string;
  cardParamMap?: {
    markdown?: string;
    text?: string;
    buttons?: string;
    inputField?: string;
  };
}

export interface IMessageItem {
  /**
   * 发送时间戳
   */
  timestamp?: number;
  /**
   * 发送方
   */
  sender?: {
    name?: string;
    /**
     * 发送者头像 URL
     */
    avatarUrl?: string;
  };
  /**
   * 角色
   */
  role?: MessageItemRole;
  /**
   * 内容
   */
  content?: string | IMessageContentData[];
  /**
   * 是否加载中
   */
  loading?: boolean;
  /**
   * 轮次 id
   */
  turnId?: string;
  /**
   * 消息 id
   */
  msgId: string;
  /**
   * 本地消息 id
   */
  localMsgId?: string;
  /**
   * 自定义消息数据
   */
  custom?: ICustomMessageData;
  /** 其他自定义字段 */
  [key: string]: any;
}

export interface IMessageItemProps {
  data: IMessageItem;
  /**
   * 是否为当前发送侧发送
   */
  isSendByMe: boolean;
  /**
   * 是否成功发送
   */
  isSendOK: boolean;
  /**
   * 自定义渲染 render
   */
  renders: IMessageRender[];
  /**
   * Agent 名称，assistant 角色消息使用
   */
  agentName?: string;
  /**
   * 是否展示头像
   */
  showAvatar?: boolean;
  /**
   * 是否展示消息头部
   */
  showHeader?: boolean;
  /**
   * 是否展示底部 meta（复制+时间），仅组内最后一条显示
   */
  showMeta?: boolean;
  /**
   * 消息底部自定义工具栏
   */
  menuProps?: DropdownProps['menu'];
  /**
   * 自定义消息头部渲染
   */
  headerElement?: React.ReactNode;
  /**
   * 重发消息
   */
  retryIcon?: {
    onClick?: (data: IMessageItem) => void;
  };
  /**
   * 自定义消息底部渲染
   */
  footerElement?: React.ReactNode;

  className?: string;

  style?: React.CSSProperties;
}

const MsgItem: React.FC<IMessageItemProps> = ({
  data,
  isSendByMe,
  isSendOK,
  showMeta = true,
  agentName,
  renders,
  menuProps,
  className,
  style,
  retryIcon,
  footerElement,
}: IMessageItemProps) => {
  const msgItemData = useMemo(() => {
    const exec = (
      index: number,
      data: IMessageRenderData,
    ): IMessageRenderData => {
      const fn = renders?.[index];
      if (!fn) {
        return data;
      }
      let time = Number.MAX_VALUE;
      let called = false;
      const next = (d: IMessageRenderData) => {
        if (called) {
          throw new Error('[message render]: next 已经执行');
        }
        if (time < Date.now()) {
          console.warn('[message render]: 在 return 之后执行 next 将会被忽略');
          return d;
        }
        called = true;
        if (renders[index + 1]) {
          return exec(index + 1, d);
        }
        return d;
      };
      const resp = fn(data, next);

      if (resp && typeof (resp as any).then === 'function') {
        throw new Error('[message render]: 仅支持同步代码');
      }
      if (called) {
        return resp;
      }
      time = Date.now();
      return exec(index + 1, resp);
    };

    return exec(0, {
      data,
      element: null,
      ext: {
        isSendByMe,
      },
    });
  }, [renders, data, isSendByMe]);

  const msgNode = msgItemData?.element;
  const elementPosType = msgItemData?.elementPosType;

  const copyTextValue = useMemo(() => {
    const content = data?.content;
    if (!content) return '';
    if (typeof content === 'string') return content;
    return getCopyText(content as IMessageContentData[]);
  }, [data?.content]);

  function onBindRetry() {
    retryIcon?.onClick?.(data);
  }

  const timeText =
    data?.timestamp === undefined ? '' : formatDate(data.timestamp);

  // 时间节点，组内最后一条消息底部展示。
  const timeNode = timeText ? (
    <span className={`${classPrefix}__body__time`}>{timeText}</span>
  ) : null;

  const [copied, setCopied] = useState(false);

  function onCopy() {
    if (!copyTextValue) return;
    void copyText(copyTextValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // 底部 meta 行：assistant [复制] [agentName] [时间]，user [时间] [复制]
  const copyBtn = copyTextValue ? (
    <button
      type="button"
      className={cls(`${classPrefix}__body__meta__copy`, {
        [`${classPrefix}__body__meta__copy--done`]: copied,
      })}
      onClick={onCopy}
    >
      {copied ? <Check /> : <Copy />}
    </button>
  ) : null;

  const agentNameNode =
    !isSendByMe && showMeta && agentName ? (
      <span
        className={`${classPrefix}__body__meta__agent-name`}
        title={agentName}
      >
        {agentName}
      </span>
    ) : null;

  const metaNode = (
    <div className={`${classPrefix}__body__meta`}>
      {isSendByMe ? (
        <>
          {timeNode}
          {copyBtn}
        </>
      ) : (
        <>
          {copyBtn}
          {agentNameNode}
          {timeNode}
        </>
      )}
    </div>
  );

  if (!msgNode) return null;

  return (
    <div
      className={cls(
        `${classPrefix}`,
        !isSendByMe ? `${classPrefix}--left` : `${classPrefix}--right`,
        className,
      )}
      style={style}
    >
      {elementPosType === EElementPosType.GLOBAL ? (
        msgNode
      ) : (
        <div className={`${classPrefix}__body`}>
          <div className={`${classPrefix}__body__content`}>
            {msgNode}
            {!!isSendByMe &&
              (menuProps?.items?.length || 0) > 0 &&
              isSendOK !== false && (
                <Dropdown
                  overlayClassName={`${classPrefix}__dropdown`}
                  menu={menuProps}
                  trigger={['click']}
                >
                  <div className={`${classPrefix}__operation`}>
                    <div className={`${classPrefix}__options`}>
                      <EllipsisOutlined />
                    </div>
                  </div>
                </Dropdown>
              )}

            {!!isSendByMe && isSendOK === false && (
              <div
                className={`${classPrefix}__retry-icon`}
                onClick={onBindRetry}
              >
                <ExclamationCircleFilled style={{ color: '#FF3333' }} />
              </div>
            )}
          </div>

          {isSendByMe ? (
            <div className={`${classPrefix}__footer`}>{footerElement}</div>
          ) : (
            footerElement
          )}

          {showMeta && metaNode}
        </div>
      )}
    </div>
  );
};

export const MessageItem = React.memo(MsgItem);
