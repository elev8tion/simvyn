import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { Duplex } from "node:stream";

// ---------------------------------------------------------------------------
// Mock socket factory — set before each test via socketFactory variable
// ---------------------------------------------------------------------------
let socketFactory: () => Duplex;

mock.module("node:net", {
  namedExports: {
    createConnection: (_socketPath: string) => socketFactory(),
  },
});

// Import AFTER mock is registered
const { MCPClient } = await import("../../shared/mcp-client.ts");
const { MCPError } = await import("../../shared/types/blitzing.ts");

/**
 * Creates a mock Duplex socket that separates the write (request) side from
 * the read (response) side, just like a real TCP socket.
 *
 * - Emits 'connect' on the next event-loop tick (unless skipConnect is true)
 * - When the MCPClient writes a request, pushes `response` back as readable
 *   data on the next tick (if provided)
 */
function makeMockSocket(opts: {
  response?: object;
  skipConnect?: boolean;
  connectError?: Error;
}): Duplex {
  const socket = new Duplex({
    read() {},
    write(
      _chunk: Buffer,
      _enc: BufferEncoding,
      cb: (err?: Error | null) => void,
    ) {
      cb();
      if (opts.response !== undefined) {
        setImmediate(() => {
          socket.push(JSON.stringify(opts.response) + "\n");
        });
      }
    },
  });

  setImmediate(() => {
    if (opts.connectError) {
      socket.emit("error", opts.connectError);
    } else if (!opts.skipConnect) {
      socket.emit("connect");
    }
  });

  return socket;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCPClient", () => {
  it("resolves text result on valid JSON-RPC response", async () => {
    socketFactory = () =>
      makeMockSocket({
        response: {
          jsonrpc: "2.0",
          id: 1,
          result: { content: [{ type: "text", text: "project list result" }] },
        },
      });

    const client = new MCPClient("/tmp/test.sock", 5_000);
    await client.connect();
    const result = await client.call("project_list");
    client.disconnect();

    assert.equal(result, "project list result");
  });

  it("throws MCPError on JSON-RPC error response", async () => {
    socketFactory = () =>
      makeMockSocket({
        response: {
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32000, message: "No project open" },
        },
      });

    const client = new MCPClient("/tmp/test.sock", 5_000);
    await client.connect();

    await assert.rejects(
      () => client.call("project_list"),
      (err: unknown) => {
        assert.ok(err instanceof MCPError, `expected MCPError, got ${String(err)}`);
        assert.equal(err.code, -32000);
        assert.equal(err.message, "No project open");
        return true;
      },
    );

    client.disconnect();
  });

  it("throws on connection timeout", async () => {
    // Socket never emits 'connect' — timeout should fire
    socketFactory = () => makeMockSocket({ skipConnect: true });

    const client = new MCPClient("/tmp/test.sock", 1); // 1 ms timeout

    await assert.rejects(
      () => client.connect(),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes("timed out"),
          `expected "timed out" in message: "${err.message}"`,
        );
        return true;
      },
    );
  });
});
