import assert from "node:assert/strict";
import { describe, it, beforeEach, mock } from "node:test";
import Fastify from "fastify";

// ---------------------------------------------------------------------------
// Local error classes — injected into mocked modules so that instanceof
// checks inside pipeline/index.ts and pipeline/service.ts match.
// ---------------------------------------------------------------------------
class SubprocessError extends Error {
  exitCode: number | null;
  stderr: string;
  constructor(message: string, exitCode: number | null, stderr: string) {
    super(message);
    this.name = "SubprocessError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

class MCPError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "MCPError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------
let mockPreflightImpl: (
  sourcePath: string,
  ipaPath?: string,
) => Promise<unknown>;

let mockCallToolImpl: (
  toolName: string,
  args?: Record<string, unknown>,
) => Promise<string>;

let mockSocketExistsImpl: () => boolean;
let callToolCallCount = 0;

// ---------------------------------------------------------------------------
// Scan result fixtures
// ---------------------------------------------------------------------------
const scanPass = {
  passed: true,
  summary: { total: 0, critical: 0, warns: 0, infos: 0, elapsed: 52_000_000 },
  findings: [],
};

const scanCritical = {
  passed: false,
  summary: { total: 2, critical: 2, warns: 0, infos: 0, elapsed: 89_000_000 },
  findings: [
    {
      severity: "CRITICAL",
      title: "Missing Privacy Manifest",
      guideline: "PRIVACY-001",
      detail: "No PrivacyInfo.xcprivacy found in bundle",
      ruleCode: "PRIV_MANIFEST_MISSING",
      filePath: "MyApp.app",
      lineNumber: 0,
    },
  ],
};

// ---------------------------------------------------------------------------
// Module mocks — must be registered BEFORE any dynamic imports
// ---------------------------------------------------------------------------

mock.module("../../shared/subprocess.js", {
  namedExports: {
    SubprocessError,
    runProcess: async () => {
      throw new SubprocessError("should not be called in pipeline tests", null, "");
    },
  },
});

mock.module("../../greenmeansgo/service.js", {
  namedExports: {
    runPreflight: async (sourcePath: string, ipaPath?: string) =>
      mockPreflightImpl(sourcePath, ipaPath),
    runCodescan: async () => {
      throw new Error("not configured for pipeline tests");
    },
    runIPAScan: async () => {
      throw new Error("not configured for pipeline tests");
    },
    runPrivacyScan: async () => {
      throw new Error("not configured for pipeline tests");
    },
    parseScanOutput: (stdout: string) => JSON.parse(stdout),
  },
});

mock.module("../../blitzing/service.js", {
  namedExports: {
    MCPError,
    callTool: async (
      toolName: string,
      args: Record<string, unknown> = {},
    ) => {
      callToolCallCount++;
      return mockCallToolImpl(toolName, args);
    },
    socketExists: () => mockSocketExistsImpl(),
    getSocketPath: () => "/tmp/blitz-test.sock",
    mapMCPErrorToHttp: () => ({
      status: 503,
      body: { error: "Blitz.app is not running" },
    }),
  },
});

// Import pipeline plugin AFTER all mocks are registered
const { pipelinePlugin } = await import("../index.ts");

const app = Fastify({ logger: false });
await app.register(pipelinePlugin, { prefix: "/api/modules/pipeline" });
await app.ready();

// ---------------------------------------------------------------------------
// Scenario 1 — scan passes + build succeeds → 200
// ---------------------------------------------------------------------------
describe("POST /api/modules/pipeline/submit — scan passes, build succeeds", () => {
  beforeEach(() => {
    callToolCallCount = 0;
    mockSocketExistsImpl = () => true;
    mockPreflightImpl = async () => scanPass;
    mockCallToolImpl = async (toolName) => {
      if (toolName === "app_store_setup_signing") return "signing configured";
      if (toolName === "app_store_build") return "build succeeded";
      if (toolName === "app_store_upload") return "upload complete";
      throw new Error(`unexpected tool call: ${toolName}`);
    };
  });

  it("returns 200 with gate:passed, scan, and build steps", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/modules/pipeline/submit",
      payload: { sourcePath: "/path/to/MyApp" },
      headers: { "content-type": "application/json" },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.gate, "passed");
    assert.ok("scan" in body, "response should include scan");
    assert.ok("build" in body, "response should include build steps");
    assert.equal(body.build.signing, "signing configured");
    assert.equal(body.build.build, "build succeeded");
    assert.equal(body.build.upload, "upload complete");
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — scan fails (critical findings) → 422, blitzing never called
// ---------------------------------------------------------------------------
describe("POST /api/modules/pipeline/submit — scan fails with critical findings", () => {
  beforeEach(() => {
    callToolCallCount = 0;
    mockSocketExistsImpl = () => true;
    mockPreflightImpl = async () => scanCritical;
    mockCallToolImpl = async () => {
      throw new Error("callTool must not be invoked when the scan gate blocks");
    };
  });

  it("returns 422 with gate:blocked and scan, never calls blitzing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/modules/pipeline/submit",
      payload: { sourcePath: "/path/to/MyApp" },
      headers: { "content-type": "application/json" },
    });

    assert.equal(response.statusCode, 422);
    const body = JSON.parse(response.body);
    assert.equal(body.gate, "blocked");
    assert.ok("scan" in body, "response should include scan");
    assert.equal(
      callToolCallCount,
      0,
      "blitzing callTool must NOT be called when scan gate blocks",
    );
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — scan passes + Blitz.app not running → 503 with scan in body
// ---------------------------------------------------------------------------
describe("POST /api/modules/pipeline/submit — scan passes, Blitz.app not running", () => {
  beforeEach(() => {
    callToolCallCount = 0;
    mockSocketExistsImpl = () => false; // socket check returns false
    mockPreflightImpl = async () => scanPass;
    mockCallToolImpl = async () => {
      throw Object.assign(
        new Error("connect ENOENT /tmp/blitz-test.sock"),
        { code: "ENOENT" },
      );
    };
  });

  it("returns 503 with gate:passed and scan result in body", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/modules/pipeline/submit",
      payload: { sourcePath: "/path/to/MyApp" },
      headers: { "content-type": "application/json" },
    });

    assert.equal(response.statusCode, 503);
    const body = JSON.parse(response.body);
    assert.equal(body.gate, "passed");
    assert.ok("scan" in body, "response should include scan result");
    assert.ok(
      typeof body.error === "string" && body.error.length > 0,
      "response should include an error message",
    );
  });
});

// ---------------------------------------------------------------------------
// Scenario 4 — scan-gate only endpoint, blitzing never invoked
// ---------------------------------------------------------------------------
describe("POST /api/modules/pipeline/scan-gate — scan-gate only, no build", () => {
  beforeEach(() => {
    callToolCallCount = 0;
    mockSocketExistsImpl = () => true;
    mockCallToolImpl = async () => {
      throw new Error("callTool must not be invoked from scan-gate endpoint");
    };
  });

  it("returns 200 with gate:passed when scan passes, never calls blitzing", async () => {
    mockPreflightImpl = async () => scanPass;

    const response = await app.inject({
      method: "POST",
      url: "/api/modules/pipeline/scan-gate",
      payload: { sourcePath: "/path/to/MyApp" },
      headers: { "content-type": "application/json" },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.gate, "passed");
    assert.ok("scan" in body, "response should include scan");
    assert.equal(
      callToolCallCount,
      0,
      "blitzing callTool must NOT be called from scan-gate",
    );
  });

  it("returns 422 with gate:blocked when scan fails, never calls blitzing", async () => {
    mockPreflightImpl = async () => scanCritical;

    const response = await app.inject({
      method: "POST",
      url: "/api/modules/pipeline/scan-gate",
      payload: { sourcePath: "/path/to/MyApp" },
      headers: { "content-type": "application/json" },
    });

    assert.equal(response.statusCode, 422);
    const body = JSON.parse(response.body);
    assert.equal(body.gate, "blocked");
    assert.ok("scan" in body, "response should include scan");
    assert.equal(
      callToolCallCount,
      0,
      "blitzing callTool must NOT be called from scan-gate",
    );
  });
});
