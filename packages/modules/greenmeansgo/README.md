# greenmeansgo

iOS compliance scanner module for simvyn. Wraps the `green-means-go` CLI to run code, privacy, and IPA audits directly from the simvyn server.

---

## Installation

The `green-means-go` binary must be installed before using this module:

```bash
brew install elev8tion/tap/green-means-go
```

Verify the install:

```bash
green-means-go --version
```

---

## Routes

All routes are mounted at `/api/modules/greenmeansgo`.

### POST /api/modules/greenmeansgo/codescan

Run a static code compliance scan against an Xcode project source tree.

**Request body:**

```json
{ "sourcePath": "/path/to/MyApp" }
```

**Example:**

```bash
curl -s -X POST http://localhost:3847/api/modules/greenmeansgo/codescan \
  -H "Content-Type: application/json" \
  -d '{"sourcePath": "/Users/me/dev/MyApp"}' | jq .
```

---

### POST /api/modules/greenmeansgo/ipa

Scan a compiled `.ipa` file. Accepts a multipart file upload.

**Example:**

```bash
curl -s -X POST http://localhost:3847/api/modules/greenmeansgo/ipa \
  -F "file=@/path/to/MyApp.ipa" | jq .
```

---

### POST /api/modules/greenmeansgo/privacy

Audit privacy manifest and permission usage declarations in the source tree.

**Request body:**

```json
{ "sourcePath": "/path/to/MyApp" }
```

**Example:**

```bash
curl -s -X POST http://localhost:3847/api/modules/greenmeansgo/privacy \
  -H "Content-Type: application/json" \
  -d '{"sourcePath": "/Users/me/dev/MyApp"}' | jq .
```

---

### POST /api/modules/greenmeansgo/preflight

Combined pre-submission check: runs both code and privacy scans. Optionally also scans an IPA if one is available.

**Request body:**

```json
{
  "sourcePath": "/path/to/MyApp",
  "ipaPath": "/path/to/MyApp.ipa"
}
```

`ipaPath` is optional. If omitted, only the source tree is scanned.

**Example:**

```bash
curl -s -X POST http://localhost:3847/api/modules/greenmeansgo/preflight \
  -H "Content-Type: application/json" \
  -d '{
    "sourcePath": "/Users/me/dev/MyApp",
    "ipaPath": "/Users/me/dev/build/MyApp.ipa"
  }' | jq .
```

---

## Response shape — ScanResult

All four routes return the same `ScanResult` envelope on success (`200`):

```json
{
  "passed": true,
  "summary": {
    "total": 12,
    "critical": 0,
    "warns": 3,
    "infos": 9,
    "elapsed": 2.41
  },
  "findings": [
    {
      "rule": "PRIV-001",
      "severity": "warn",
      "message": "NSLocationWhenInUseUsageDescription missing purpose string",
      "file": "Info.plist",
      "line": 42
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `passed` | boolean | `true` when `critical` is 0 |
| `summary.total` | integer | Total finding count |
| `summary.critical` | integer | Blocking findings — must be 0 to pass |
| `summary.warns` | integer | Non-blocking warnings |
| `summary.infos` | integer | Informational notices |
| `summary.elapsed` | number | Scan duration in seconds |
| `findings` | array | Individual finding objects (rule, severity, message, file, line) |

### Error responses

| Status | Meaning |
|---|---|
| `400` | Missing required field (`sourcePath` or `ipa` file) |
| `503` | `green-means-go` binary not found or not runnable |
| `504` | Scan exceeded the configured timeout |
| `500` | Scanner exited with a non-zero code (see `detail` field) |

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `GREENMEANSGO_BINARY` | `green-means-go` | Override the path to the binary, e.g. if installed to a non-standard prefix |
| `GREENMEANSGO_TIMEOUT_MS` | `30000` | Maximum milliseconds to wait for a scan to complete before returning 504 |

Example:

```bash
GREENMEANSGO_BINARY=/opt/homebrew/bin/green-means-go \
GREENMEANSGO_TIMEOUT_MS=60000 \
npx simvyn start
```
