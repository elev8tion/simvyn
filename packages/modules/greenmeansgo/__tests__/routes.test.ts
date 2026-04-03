import assert from "node:assert/strict";
import { describe, it, beforeEach, mock } from "node:test";
import Fastify from "fastify";

// ---------------------------------------------------------------------------
// Shared SubprocessError class — mocked into subprocess module so that the
// instanceof check in index.ts uses this same class reference.
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

// --- Mock state ---
let mockCodescanImpl: (sourcePath: string) => Promise<unknown> = async () => {
  throw new Error("mockCodescanImpl not configured");
};

// Mock subprocess module so index.ts receives our SubprocessError class
mock.module("../../shared/subprocess.js", {
  namedExports: {
    SubprocessError,
    runProcess: async () => {
      throw new SubprocessError("should not be called in route tests", null, "");
    },
  },
});

// Mock the service module to control responses
mock.module("../service.js", {
  namedExports: {
    runCodescan: async (sourcePath: string) => mockCodescanImpl(sourcePath),
    runIPAScan: async () => {
      throw new SubprocessError("not configured", 2, "");
    },
    runPrivacyScan: async () => {
      throw new SubprocessError("not configured", 2, "");
    },
    runPreflight: async () => {
      throw new SubprocessError("not configured", 2, "");
    },
    parseScanOutput: (stdout: string) => JSON.parse(stdout),
  },
});

// Import plugin AFTER mocks are registered
const { greenmeansgoPlugin } = await import("../index.ts");

// Fixture data
const scanPass = {
  passed: true,
  summary: { total: 0, critical: 0, warns: 0, infos: 0, elapsed: 52000000 },
  findings: [],
};

const scanCritical = {
  passed: false,
  summary: { total: 2, critical: 2, warns: 0, infos: 0, elapsed: 89000000 },
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
    {
      severity: "CRITICAL",
      title: "Unencrypted Data at Rest",
      guideline: "DATA-003",
      detail: "NSFileProtectionNone detected on sensitive files",
      ruleCode: "DATA_ENCRYPTION_MISSING",
      filePath: "MyApp.app/Documents",
      lineNumber: 0,
    },
  ],
};

// Build one Fastify instance shared across all route tests
const app = Fastify({ logger: false });
await app.register(greenmeansgoPlugin, {
  prefix: "/api/modules/greenmeansgo",
});
await app.ready();

// ---------------------------------------------------------------------------
// POST /api/modules/greenmeansgo/codescan
// ---------------------------------------------------------------------------
describe("POST /api/modules/greenmeansgo/codescan", () => {
  beforeEach(() => {
    mockCodescanImpl = async () => {
      throw new Error("mockCodescanImpl not configured");
    };
  });

  it("returns 400 when sourcePath is missing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/modules/greenmeansgo/codescan",
      payload: {},
      headers: { "content-type": "application/json" },
    });

    assert.equal(response.statusCode, 400);
  });

  it("returns 200 with ScanResult shape when scan passes", async () => {
    mockCodescanImpl = async () => scanPass;

    const response = await app.inject({
      method: "POST",
      url: "/api/modules/greenmeansgo/codescan",
      payload: { sourcePath: "/path/to/MyApp" },
      headers: { "content-type": "application/json" },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.passed, true);
    assert.equal(body.findings.length, 0);
    assert.ok("summary" in body, "response should include summary");
    assert.ok("findings" in body, "response should include findings");
  });

  it("returns 200 with passed:false when CRITICAL findings exist (not an HTTP error)", async () => {
    mockCodescanImpl = async () => scanCritical;

    const response = await app.inject({
      method: "POST",
      url: "/api/modules/greenmeansgo/codescan",
      payload: { sourcePath: "/path/to/MyApp" },
      headers: { "content-type": "application/json" },
    });

    assert.equal(response.statusCode, 200, "CRITICAL findings must NOT produce an HTTP error");
    const body = JSON.parse(response.body);
    assert.equal(body.passed, false);
    assert.equal(body.summary.critical, 2);
    assert.equal(body.findings.length, 2);
  });

  it("returns 503 when binary is not available", async () => {
    mockCodescanImpl = async () => {
      throw new SubprocessError(
        "spawn green-means-go ENOENT",
        null,
        "",
      );
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/modules/greenmeansgo/codescan",
      payload: { sourcePath: "/path/to/MyApp" },
      headers: { "content-type": "application/json" },
    });

    assert.equal(response.statusCode, 503);
    const body = JSON.parse(response.body);
    assert.equal(body.error, "green-means-go binary not available");
  });

  it("returns 504 when scan times out", async () => {
    mockCodescanImpl = async () => {
      throw new SubprocessError(
        "Process timed out after 30000ms: green-means-go",
        null,
        "",
      );
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/modules/greenmeansgo/codescan",
      payload: { sourcePath: "/path/to/MyApp" },
      headers: { "content-type": "application/json" },
    });

    assert.equal(response.statusCode, 504);
    const body = JSON.parse(response.body);
    assert.equal(body.error, "Scan timed out");
  });
});
