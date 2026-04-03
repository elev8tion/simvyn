export interface MCPCallRequest {
  jsonrpc: "2.0";
  id: number;
  method: "tools/call";
  params: { name: string; arguments?: Record<string, unknown> };
}

export interface MCPTextResponse {
  jsonrpc: "2.0";
  id: number;
  result: { content: Array<{ type: "text"; text: string }> };
}

export interface MCPErrorResponse {
  jsonrpc: "2.0";
  id: number;
  error: { code: number; message: string };
}

export class MCPError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "MCPError";
  }
}
