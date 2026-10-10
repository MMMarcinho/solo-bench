export enum MessageContentType {
  Text = 'text',
  ToolUse = 'toolUse',
}

export enum MessageItemRole {
  Assistant = 'assistant',
  User = 'user',
  ToolResult = 'toolResult',
  Custom = 'custom',
}

export enum MessageChunkType {
  Text = 'text',
  ToolUse = 'toolUse',
  ToolResult = 'toolResult',
  Status = 'status',
  Error = 'error',
  Log = 'log',
}
