import { TOOL_CALL_AGGREGATED_KEY } from '@/constants';
import type { ITokenUsage } from '@/TokenUsage';
import { IToolCall } from '@/typings/tool';
import type {
  IMessageContentData,
  IMessageContentToolUseData,
} from '../../MessageContent';
import type { IMessageItem } from '../../MessageItem';
import { MessageContentType, MessageItemRole } from '../../typings';

/** 将连续工具调用聚合后的消息结构。 */
export interface IToolCallAggregated {
  type: string;
  toolCalls: IToolCall[];
  role: MessageItemRole;
  id?: string;
  turnId?: string;
  timestamp?: number;
  sender?: IMessageItem['sender'];
  /** 原始 assistant 消息的 Token 消耗，展示在最后一段工具调用下方。 */
  usage?: ITokenUsage;
  /** 是否仍有工具调用尚未收到结果。 */
  streaming?: boolean;
}

/** 刷新连续工具调用的参数。 */
interface IFlushToolCallsOptions {
  toolCalls: IToolCall[];
  result: Array<IMessageItem | IToolCallAggregated>;
  groupId: string;
  item: IMessageItem;
  /** 当前工具调用段位于原始消息末尾时，携带该消息的 Token 消耗。 */
  usage?: ITokenUsage;
}

interface IToolCallLocation {
  /** 工具调用所在消息在结果列表中的索引。 */
  messageIndex: number;
  /** 工具调用所在内容项的索引。 */
  contentIndex: number;
  /** 是否已被无 toolCallId 的结果消息回填。 */
  resolved: boolean;
}

/**
 * 判断当前内容项是否是工具调用。
 */
function isToolUseItem(
  item: IMessageContentData,
): item is IMessageContentToolUseData {
  return item?.type === MessageContentType.ToolUse;
}

/**
 * 判断工具调用是否还没有结果。
 */
function isEmptyToolCallOutput(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * 把工具调用登记到索引中，供后续工具结果以 O(1) 定位。
 */
function registerToolCalls(options: {
  /** 当前工具调用消息。 */
  message: IMessageItem;
  /** 消息在结果列表中的索引。 */
  messageIndex: number;
  /** 按工具调用 ID 查找位置的索引。 */
  toolCallLocationMap: Map<string, IToolCallLocation[]>;
  /** 未完成工具调用的倒序栈。 */
  unresolvedToolCalls: IToolCallLocation[];
}) {
  const { message, messageIndex, toolCallLocationMap, unresolvedToolCalls } =
    options;
  const content = message.content;

  if (!Array.isArray(content)) {
    return;
  }

  content.forEach((item, contentIndex) => {
    if (!isToolUseItem(item)) {
      return;
    }

    const location: IToolCallLocation = {
      messageIndex,
      contentIndex,
      resolved: !isEmptyToolCallOutput(item.output),
    };

    if (item.id) {
      const locations = toolCallLocationMap.get(item.id) || [];
      locations.push(location);
      toolCallLocationMap.set(item.id, locations);
    }

    if (!location.resolved) {
      unresolvedToolCalls.push(location);
    }
  });
}

/**
 * 找到工具结果应回填的调用位置：优先按 ID 精确匹配，否则取最近的未完成调用。
 */
function findToolCallLocation(options: {
  /** 工具结果消息。 */
  toolResult: IMessageItem;
  /** 按工具调用 ID 查找位置的索引。 */
  toolCallLocationMap: Map<string, IToolCallLocation[]>;
  /** 未完成工具调用的倒序栈。 */
  unresolvedToolCalls: IToolCallLocation[];
}) {
  const { toolResult, toolCallLocationMap, unresolvedToolCalls } = options;
  const { toolCallId } = toolResult;

  if (toolCallId) {
    const locations = toolCallLocationMap.get(toolCallId);

    return locations?.[locations.length - 1];
  }

  while (unresolvedToolCalls.length > 0) {
    const location = unresolvedToolCalls.pop();

    if (location && !location.resolved) {
      return location;
    }
  }

  return undefined;
}

/**
 * 将工具结果消息并入对应的工具调用，未命中时保留原消息兜底展示。
 */
export function mergeToolResultMessages(data?: IMessageItem[]): IMessageItem[] {
  if (!Array.isArray(data) || data.length === 0) return [];

  // key 是 toolCallId，value 是该调用在结果列表中的位置。
  // 同一个 id 理论上可能重复出现，因此用数组保留全部位置并优先取最近一条。
  const toolCallLocationMap = new Map<string, IToolCallLocation[]>();
  // 未携带 toolCallId 的结果消息，只能回填到最近一个尚未完成的工具调用。
  const unresolvedToolCalls: IToolCallLocation[] = [];

  return data.reduce<IMessageItem[]>((list, item) => {
    const isToolResult = item?.role === MessageItemRole.ToolResult;

    if (!isToolResult) {
      // 普通消息直接保留；若其中包含 ToolUse，同时登记位置供后续结果快速定位。
      list.push(item);
      registerToolCalls({
        message: item,
        messageIndex: list.length - 1,
        toolCallLocationMap,
        unresolvedToolCalls,
      });
      return list;
    }

    // 工具结果优先按 toolCallId 匹配；协议未下发 id 时才回填最近未完成调用。
    const location = findToolCallLocation({
      toolResult: item,
      toolCallLocationMap,
      unresolvedToolCalls,
    });
    const message = location ? list[location.messageIndex] : undefined;
    const content = message?.content;

    if (!location || !message || !Array.isArray(content)) {
      // 未找到对应 ToolUse 时保留原始 ToolResult，避免丢失服务端下发的信息。
      list.push(item);
      return list;
    }

    // 不直接修改历史消息：复制目标 content 后，仅替换命中工具调用的 output。
    const nextContent = [...content];
    const toolCall = nextContent[
      location.contentIndex
    ] as IMessageContentToolUseData;
    nextContent[location.contentIndex] = {
      ...toolCall,
      output: item.content,
      endedAt: item.endedAt,
      streaming: false,
    };
    list[location.messageIndex] = {
      ...message,
      content: nextContent,
    };
    // 标记已回填；后续没有 toolCallId 的结果会跳过该调用。
    location.resolved = true;

    return list;
  }, []);
}

/**
 * 判断消息是否为工具调用聚合项。
 */
export function isToolCallAggregated(
  item: IMessageItem | IToolCallAggregated,
): item is IToolCallAggregated {
  return (item as IToolCallAggregated)?.type === TOOL_CALL_AGGREGATED_KEY;
}

/**
 * 获取消息的分组 ID。优先使用 turnId，否则从消息 id 中提取。
 */
export function getMessageGroupId(
  item: IMessageItem | IToolCallAggregated,
): string {
  if (isToolCallAggregated(item)) return item.id || '';
  const { turnId, id } = item || {};
  if (turnId) return turnId;
  if (!id) return '';

  const parts = id.split('-');
  return parts.length >= 3 ? parts.slice(0, -1).join('-') : id;
}

/**
 * 将收集到的连续工具调用刷新到结果列表，并合并相邻同组工具调用。
 */
function flushToolCalls(options: IFlushToolCallsOptions): void {
  const { toolCalls, result, groupId, item, usage } = options;
  if (toolCalls?.length === 0) return;

  // 工具结果为空表示仍在执行，聚合前统一刷新每一项的 streaming 状态。
  const callsWithStreaming = toolCalls?.map((toolCall) => ({
    ...toolCall,
    streaming: isEmptyToolCallOutput(toolCall.output),
  }));
  // 聚合项中有任意一个调用未完成，整组即保持执行中状态。
  const groupStreaming = callsWithStreaming?.some(
    (toolCall) => toolCall?.streaming,
  );

  // 仅向前合并相邻的同组聚合项，避免跨消息组拼接工具调用。
  for (let index = result?.length - 1; index >= 0; index -= 1) {
    const previous = result?.[index];
    if (isToolCallAggregated(previous) && previous?.id === groupId) {
      previous.toolCalls.push(...callsWithStreaming);
      previous.timestamp = item.timestamp;
      previous.streaming = previous.streaming || groupStreaming;
      if (usage) {
        previous.usage = usage;
      }
      return;
    }
    // 遇到其他聚合组时，后续内容不再属于当前连续调用。
    if (isToolCallAggregated(previous) && previous.id !== groupId) break;

    if (!isToolCallAggregated(previous)) {
      const previousGroupId = getMessageGroupId(previous);
      // 遇到其他轮次的普通消息时停止，确保只合并相邻消息。
      if (previousGroupId && previousGroupId !== groupId) break;
    }
  }

  // 没有可复用的相邻聚合项时，创建新的工具调用聚合项。
  result.push({
    type: TOOL_CALL_AGGREGATED_KEY,
    toolCalls: callsWithStreaming,
    role: MessageItemRole.Assistant,
    id: groupId,
    turnId: item.turnId,
    timestamp: item.timestamp,
    sender: item.sender,
    usage,
    streaming: groupStreaming,
  });
}

/**
 * 将同组连续的工具调用消息合并成一个消息项，使 ToolCall 组件能整体渲染摘要。
 */
export function aggregateToolCallMessages(
  data: IMessageItem[],
): Array<IMessageItem | IToolCallAggregated> {
  const result: Array<IMessageItem | IToolCallAggregated> = [];
  // 先统计同一轮中的工具调用总数，只有多个调用时才展示聚合摘要。
  const groupToolCount: Record<string, number> = {};

  // ToolUse 与独立 ToolResult 都计入调用数量，兼容流式消息的拆分形态。
  for (const item of data) {
    const role = item?.role;
    const groupId = getMessageGroupId(item);
    const contentList = Array.isArray(item.content) ? item.content : [];
    if (!groupId) continue;

    const isToolResult = role === MessageItemRole.ToolResult;
    const assistantContentHasToolUse =
      item?.role === MessageItemRole.Assistant &&
      contentList.some((content) => isToolUseItem(content));

    if (isToolResult) {
      groupToolCount[groupId] = (groupToolCount[groupId] || 0) + 1;
    } else if (assistantContentHasToolUse) {
      const toolUseCount = contentList.filter((content) =>
        isToolUseItem(content),
      ).length;
      groupToolCount[groupId] = (groupToolCount[groupId] || 0) + toolUseCount;
    }
  }

  // 第二次遍历按原始消息顺序输出，保证文本与工具调用的相对位置不变。
  for (const item of data) {
    const groupId = getMessageGroupId(item);
    const role = String(item?.role).toLowerCase();
    const isToolResult = role === MessageItemRole.ToolResult;
    const contentList = Array.isArray(item.content) ? item.content : [];
    const assistantContentHasToolUse =
      role === MessageItemRole.Assistant &&
      contentList.some((content) => isToolUseItem(content));
    // 同组仅一个调用时保留原消息，避免产生没有收益的聚合展示。
    const shouldAggregate = !!(groupId && (groupToolCount[groupId] || 0) > 1);

    if (assistantContentHasToolUse) {
      if (!shouldAggregate) {
        result.push(item);
        continue;
      }

      // 连续 ToolUse 合为一段；中间文本仍按原位置作为独立消息输出。
      let currentToolCalls: IToolCallAggregated['toolCalls'] = [];
      for (
        let contentIndex = 0;
        contentIndex < contentList.length;
        contentIndex += 1
      ) {
        const content = contentList[contentIndex];
        if (isToolUseItem(content)) {
          currentToolCalls.push({
            id: content.id,
            name: content.name,
            startedAt: content.startedAt,
            endedAt: content.endedAt,
            input: content.input,
            output: content.output,
            streaming: content.streaming,
          });
          continue;
        }

        if (currentToolCalls.length > 0) {
          // 遇到文本时先提交前面已收集的连续工具调用。
          flushToolCalls({
            toolCalls: currentToolCalls,
            result,
            groupId,
            item,
          });
          currentToolCalls = [];
        }
        // Token 消耗属于整条 assistant 消息，只附着在最后一个拆分出的展示项上。
        result.push({
          ...item,
          content: [content],
          usage:
            contentIndex === contentList.length - 1 ? item.usage : undefined,
        });
      }

      if (currentToolCalls.length > 0) {
        // 补充提交内容末尾没有被文本打断的工具调用。
        flushToolCalls({
          toolCalls: currentToolCalls,
          result,
          groupId,
          item,
          usage: item.usage,
        });
      }
      continue;
    }

    if (isToolResult && shouldAggregate) {
      // ToolResult 本身不渲染为独立项，而是补入同组的聚合工具调用。
      const newCall: IToolCall = {
        id: item?.id || item?.msgId,
        name: item?.toolName || item?.name,
        startedAt: item?.startedAt,
        endedAt: item?.endedAt,
        input: item?.input || item?.arguments,
        output: item?.content,
        streaming: false,
      };

      let foundPrevious = false;
      // 倒序查找相邻同组聚合项，保证结果回填到正确的调用序列。
      for (let index = result.length - 1; index >= 0; index -= 1) {
        const previous = result[index];
        if (isToolCallAggregated(previous) && previous.id === groupId) {
          previous.toolCalls.push(newCall);
          previous.timestamp = item.timestamp;
          previous.streaming = previous.toolCalls.some((toolCall) =>
            isEmptyToolCallOutput(toolCall.output),
          );
          foundPrevious = true;
          break;
        }
        if (isToolCallAggregated(previous) && previous.id !== groupId) break;

        if (!isToolCallAggregated(previous)) {
          const previousGroupId = getMessageGroupId(previous);
          if (previousGroupId && previousGroupId !== groupId) break;
        }
      }

      if (!foundPrevious) {
        // 流式片段可能先到结果；此时先创建聚合项等待后续内容合并。
        result.push({
          type: TOOL_CALL_AGGREGATED_KEY,
          toolCalls: [newCall],
          role: MessageItemRole.Assistant,
          id: groupId,
          turnId: item.turnId,
          timestamp: item.timestamp,
          sender: item.sender,
          streaming: false,
        });
      }
      continue;
    }

    result.push(item);
  }

  return result;
}
