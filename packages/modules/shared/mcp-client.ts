import * as net from "node:net";
import * as os from "node:os";
import type { MCPCallRequest, MCPTextResponse, MCPErrorResponse } from "./types/blitzing.js";
import { MCPError } from "./types/blitzing.js";

function defaultSocketPath(): string {
  const env = process.env["BLITZSOCKETPATH"];
  if (env) return env;
  const uid = process.getuid?.() ?? os.userInfo().uid;
  return `/tmp/blitz-mcp-${uid}.sock`;
}

export class MCPClient {
  private socket: net.Socket | null = null;
  private nextId = 1;

  constructor(
    private readonly socketPath: string = defaultSocketPath(),
    private readonly timeoutMs: number = 10_000,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection(this.socketPath);

      const timer = setTimeout(() => {
        sock.destroy();
        reject(new Error(`MCP connect timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      sock.once("connect", () => {
        clearTimeout(timer);
        this.socket = sock;
        resolve();
      });

      sock.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  call(toolName: string, args: Record<string, unknown> = {}): Promise<string> {
    const sock = this.socket;
    if (!sock) {
      return Promise.reject(new Error("MCPClient: not connected — call connect() first"));
    }

    const id = this.nextId++;
    const request: MCPCallRequest = {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        sock.removeAllListeners("data");
        sock.removeAllListeners("error");
        reject(new Error(`MCP call timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      let buffer = "";

      const onData = (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const newline = buffer.indexOf("\n");
        if (newline === -1) return;

        clearTimeout(timer);
        sock.removeListener("data", onData);
        sock.removeListener("error", onError);

        const line = buffer.slice(0, newline).trim();
        try {
          const response = JSON.parse(line) as MCPTextResponse | MCPErrorResponse;

          if ("error" in response && response.error != null) {
            const err = (response as MCPErrorResponse).error;
            reject(new MCPError(err.code, err.message));
            return;
          }

          const text = (response as MCPTextResponse).result?.content?.[0]?.text;
          if (typeof text !== "string") {
            reject(new Error("MCP response missing text content"));
            return;
          }
          resolve(text);
        } catch (parseErr) {
          reject(new Error(`MCP response parse error: ${String(parseErr)}`));
        }
      };

      const onError = (err: Error) => {
        clearTimeout(timer);
        sock.removeListener("data", onData);
        reject(err);
      };

      sock.on("data", onData);
      sock.once("error", onError);

      sock.write(JSON.stringify(request) + "\n", "utf8");
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }
}
