import assert from "node:assert/strict";
import { describe, it, beforeEach, mock } from "node:test";
import Fastify from "fastify";

// ---------------------------------------------------------------------------
// Local MCPError so instanceof checks in the mocked mapMCPErrorToHttp work
// ---------------------------------------------------------------------------
class MCPError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "MCPError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Mutable mock state — reset in beforeEach per describe block
// ---------------------------------------------------------------------------
let mockCallToolImpl: (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<string>;

// ---------------------------------------------------------------------------
// Mock the blitzing service module BEFORE importing the plugin
// ---------------------------------------------------------------------------
mock.module("../service.js", {
  namedExports: {
    MCPError,
    getSocketPath: () => "/tmp/blitz-test.sock",
    socketExists: () => false,
    callTool: async (toolName: string, args: Record<string, unknown> = {}) =>
      mockCallToolImpl(toolName, args),
    mapMCPErrorToHttp: (
      err: unknown,
    ): { status: number; body: { error: string } } => {
      if (err instanceof MCPError && err.code === -32000) {
        return { status: 400, body: { error: (err as MCPError).message } };
      }
      if (err instanceof Error) {
        if (err.message.includes("timed out")) {
          return {
            status: 504,
            body: { error: "Blitz.app connection timed out" },
          };
        }
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === "ENOENT" || nodeErr.code === "ECONNREFUSED") {
          return { status: 503, body: { error: "Blitz.app is not running" } };
        }
      }
      return { status: 503, body: { error: "Blitz.app is not running" } };
    },
  },
});

// Import plugin AFTER mocks are registered
const { blitzingPlugin } = await import("../index.ts");

// Single Fastify instance shared across all route tests
const app = Fastify({ logger: false, ignoreTrailingSlash: true });
await app.register(blitzingPlugin, { prefix: "/api/modules/blitzing" });
await app.ready();

// ---------------------------------------------------------------------------
// GET /api/modules/blitzing/projects
// ---------------------------------------------------------------------------
describe("GET /api/modules/blitzing/projects", () => {
  beforeEach(() => {
    mockCallToolImpl = async () => {
      throw new Error("mockCallToolImpl not configured");
    };
  });

  it("returns 200 with result on success", async () => {
    mockCallToolImpl = async () => "project list result";

    const response = await app.inject({
      method: "GET",
      url: "/api/modules/blitzing/projects",
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.result, "project list result");
  });

  it("returns 503 when socket not found (ENOENT)", async () => {
    mockCallToolImpl = async () => {
      throw Object.assign(
        new Error("connect ENOENT /tmp/blitz-test.sock"),
        { code: "ENOENT" },
      );
    };

    const response = await app.inject({
      method: "GET",
      url: "/api/modules/blitzing/projects",
    });

    assert.equal(response.statusCode, 503);
    const body = JSON.parse(response.body);
    assert.equal(body.error, "Blitz.app is not running");
  });
});

// ---------------------------------------------------------------------------
// POST /api/modules/blitzing/build  (calls app_store_build tool)
// ---------------------------------------------------------------------------
describe("POST /api/modules/blitzing/build", () => {
  beforeEach(() => {
    mockCallToolImpl = async () => {
      throw new Error("mockCallToolImpl not configured");
    };
  });

  it("returns 200 with mocked build response", async () => {
    mockCallToolImpl = async () => "build succeeded";

    const response = await app.inject({
      method: "POST",
      url: "/api/modules/blitzing/build",
      payload: {},
      headers: { "content-type": "application/json" },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.ok("result" in body, "response should have a result property");
    assert.equal(body.result, "build succeeded");
  });
});
