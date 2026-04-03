import assert from "node:assert/strict";
import { describe, it, beforeEach, mock } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const scanPass = JSON.parse(
  readFileSync(join(__dirname, "fixtures/scan-pass.json"), "utf8"),
);
const scanCritical = JSON.parse(
  readFileSync(join(__dirname, "fixtures/scan-critical.json"), "utf8"),
);
const scanWarn = JSON.parse(
  readFileSync(join(__dirname, "fixtures/scan-warn.json"), "utf8"),
);

// --- Mock state ---
let mockRunProcessImpl: (
  binary: string,
  args: string[],
  timeout: number,
) => Promise<{ stdout: string; stderr: string; exitCode: number }> = async () => {
  throw new Error("mockRunProcessImpl not configured");
};

const writtenPaths: string[] = [];
const unlinkedPaths: string[] = [];

// Mock SubprocessError for use inside mock throws
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

// --- Mock subprocess module ---
mock.module("../../shared/subprocess.js", {
  namedExports: {
    SubprocessError,
    runProcess: async (binary: string, args: string[], timeout: number) =>
      mockRunProcessImpl(binary, args, timeout),
  },
});

// --- Mock fs/promises to track temp file lifecycle ---
mock.module("node:fs/promises", {
  namedExports: {
    writeFile: async (path: unknown, _data: unknown) => {
      writtenPaths.push(String(path));
    },
    unlink: async (path: unknown) => {
      unlinkedPaths.push(String(path));
    },
  },
});

const { parseScanOutput, runCodescan, runIPAScan } = await import(
  "../service.ts"
);

// ---------------------------------------------------------------------------
// parseScanOutput
// ---------------------------------------------------------------------------
describe("parseScanOutput", () => {
  it("returns parsed ScanResult for a passing scan", () => {
    const result = parseScanOutput(JSON.stringify(scanPass));
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
    assert.equal(result.summary.total, 0);
  });

  it("returns parsed ScanResult for a critical scan", () => {
    const result = parseScanOutput(JSON.stringify(scanCritical));
    assert.equal(result.passed, false);
    assert.equal(result.summary.critical, 2);
    assert.equal(result.findings.length, 2);
  });

  it("throws on invalid JSON", () => {
    assert.throws(
      () => parseScanOutput("not-valid-json{{{"),
      (err: Error) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("Failed to parse"));
        return true;
      },
    );
  });

  it("throws on empty string", () => {
    assert.throws(() => parseScanOutput(""));
  });
});

// ---------------------------------------------------------------------------
// runCodescan
// ---------------------------------------------------------------------------
describe("runCodescan", () => {
  beforeEach(() => {
    mockRunProcessImpl = async () => {
      throw new Error("mockRunProcessImpl not configured");
    };
  });

  it("calls runProcess with correct codescan args and returns ScanResult", async () => {
    let capturedBinary = "";
    let capturedArgs: string[] = [];

    mockRunProcessImpl = async (binary, args) => {
      capturedBinary = binary;
      capturedArgs = [...args];
      return { stdout: JSON.stringify(scanPass), stderr: "", exitCode: 0 };
    };

    const result = await runCodescan("/path/to/src");

    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
    assert.equal(capturedBinary, "green-means-go");
    assert.deepEqual(capturedArgs, [
      "codescan",
      "--path",
      "/path/to/src",
      "--format",
      "json",
    ]);
  });

  it("returns passed:false when critical findings present", async () => {
    mockRunProcessImpl = async () => ({
      stdout: JSON.stringify(scanCritical),
      stderr: "",
      exitCode: 0,
    });

    const result = await runCodescan("/path/to/src");
    assert.equal(result.passed, false);
    assert.equal(result.summary.critical, 2);
    assert.equal(result.findings.length, 2);
  });

  it("returns scan result with warnings", async () => {
    mockRunProcessImpl = async () => ({
      stdout: JSON.stringify(scanWarn),
      stderr: "",
      exitCode: 0,
    });

    const result = await runCodescan("/path/to/src");
    assert.equal(result.passed, true);
    assert.equal(result.summary.warns, 3);
  });

  it("propagates SubprocessError for timeout (exitCode null)", async () => {
    mockRunProcessImpl = async () => {
      throw new SubprocessError(
        "Process timed out after 30000ms: green-means-go",
        null,
        "",
      );
    };

    await assert.rejects(
      () => runCodescan("/path/to/src"),
      (err: unknown) => {
        assert.ok(err instanceof SubprocessError);
        assert.equal(err.exitCode, null);
        assert.ok(err.message.includes("timed out"));
        return true;
      },
    );
  });

  it("propagates SubprocessError for usage error (exitCode 2)", async () => {
    mockRunProcessImpl = async () => {
      throw new SubprocessError(
        "Process exited with code 2: green-means-go",
        2,
        "usage: green-means-go codescan",
      );
    };

    await assert.rejects(
      () => runCodescan("/path/to/src"),
      (err: unknown) => {
        assert.ok(err instanceof SubprocessError);
        assert.equal((err as SubprocessError).exitCode, 2);
        return true;
      },
    );
  });

  it("uses GREENMEANSGO_BINARY env var when set", async () => {
    process.env["GREENMEANSGO_BINARY"] = "custom-ios-scanner";
    let capturedBinary = "";

    mockRunProcessImpl = async (binary) => {
      capturedBinary = binary;
      return { stdout: JSON.stringify(scanPass), stderr: "", exitCode: 0 };
    };

    try {
      await runCodescan("/src");
    } finally {
      delete process.env["GREENMEANSGO_BINARY"];
    }

    assert.equal(capturedBinary, "custom-ios-scanner");
  });
});

// ---------------------------------------------------------------------------
// runIPAScan
// ---------------------------------------------------------------------------
describe("runIPAScan", () => {
  beforeEach(() => {
    writtenPaths.length = 0;
    unlinkedPaths.length = 0;
    mockRunProcessImpl = async () => {
      throw new Error("mockRunProcessImpl not configured");
    };
  });

  it("writes temp .ipa file, calls runProcess with ipa args, then cleans up", async () => {
    let capturedArgs: string[] = [];

    mockRunProcessImpl = async (_binary, args) => {
      capturedArgs = [...args];
      return { stdout: JSON.stringify(scanPass), stderr: "", exitCode: 0 };
    };

    const result = await runIPAScan(Buffer.from("fake-ipa"), "MyApp.ipa");

    assert.equal(result.passed, true);
    // temp file was written
    assert.equal(writtenPaths.length, 1);
    assert.ok(writtenPaths[0].endsWith(".ipa"), "temp file should have .ipa extension");
    // ipa args correct
    assert.equal(capturedArgs[0], "ipa");
    assert.equal(capturedArgs[1], "--ipa");
    assert.equal(capturedArgs[2], writtenPaths[0]);
    // cleaned up
    assert.equal(unlinkedPaths.length, 1);
    assert.equal(unlinkedPaths[0], writtenPaths[0]);
  });

  it("cleans up temp file even when runProcess throws", async () => {
    mockRunProcessImpl = async () => {
      throw new SubprocessError("Process exited with code 2: green-means-go", 2, "err");
    };

    await assert.rejects(() => runIPAScan(Buffer.from("fake-ipa"), "bad.ipa"));

    assert.equal(writtenPaths.length, 1, "temp file should have been written");
    assert.equal(unlinkedPaths.length, 1, "temp file should be deleted in finally");
    assert.equal(writtenPaths[0], unlinkedPaths[0]);
  });
});
