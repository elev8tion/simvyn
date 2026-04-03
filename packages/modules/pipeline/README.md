# pipeline

Compliance-gated App Store submission orchestrator for simvyn. Runs a `green-means-go` preflight scan before handing off to the blitzing build pipeline, ensuring no build is submitted with unresolved critical findings.

---

## Dependencies

- **greenmeansgo module** — `green-means-go` binary must be installed (`brew install elev8tion/tap/green-means-go`)
- **blitzing module** — Blitz.app must be running and connected to an Xcode project for `/submit`

The scan gate (`/scan-gate`) works without Blitz.app. The full submission route (`/submit`) requires both.

---

## Workflow

```
POST /api/modules/pipeline/submit
  |
  v
  greenmeansgo preflight (codescan + privacy + optional IPA scan)
  |
  v
  CRITICAL findings?
  |
  +-- Yes --> 422 { gate: "blocked", scan: {...} }  (stop here, build not started)
  |
  +-- No  --> blitzing: POST /build/signing
                          |
                          v
                        blitzing: POST /build/
                          |
                          v
                        blitzing: POST /build/upload
                          |
                          v
                        200 { gate: "passed", scan: {...}, build: { signing, build, upload } }
```

If Blitz.app is not running after the scan passes, the response is `503` with the passing scan included so callers can surface the compliance result even when the build step fails.

---

## Routes

All routes are mounted at `/api/modules/pipeline`.

---

### POST /api/modules/pipeline/scan-gate

Run the preflight compliance check and return the gate decision. Does **not** start a build. Use this to check compliance without triggering a submission.

**Request body:**

```json
{
  "sourcePath": "/path/to/MyApp",
  "ipaPath": "/path/to/MyApp.ipa"
}
```

`ipaPath` is optional.

**Success response (`200`) — scan passed:**

```json
{
  "gate": "passed",
  "scan": {
    "passed": true,
    "summary": { "total": 5, "critical": 0, "warns": 2, "infos": 3, "elapsed": 1.8 },
    "findings": []
  }
}
```

**Blocked response (`422`) — critical findings present:**

```json
{
  "gate": "blocked",
  "scan": {
    "passed": false,
    "summary": { "total": 8, "critical": 2, "warns": 3, "infos": 3, "elapsed": 2.1 },
    "findings": [
      {
        "rule": "CODE-007",
        "severity": "critical",
        "message": "Hardcoded API key detected",
        "file": "NetworkManager.swift",
        "line": 34
      }
    ]
  },
  "message": "2 critical finding(s) must be resolved before submission"
}
```

**Example:**

```bash
curl -s -X POST http://localhost:3847/api/modules/pipeline/scan-gate \
  -H "Content-Type: application/json" \
  -d '{
    "sourcePath": "/Users/me/dev/MyApp",
    "ipaPath": "/Users/me/dev/build/MyApp.ipa"
  }' | jq .
```

---

### POST /api/modules/pipeline/submit

Run the full compliance-gated submission pipeline: scan → signing → build → upload.

**Request body:**

```json
{
  "sourcePath": "/path/to/MyApp",
  "ipaPath": "/path/to/MyApp.ipa",
  "build": {
    "scheme": "MyApp",
    "configuration": "Release",
    "skipPolling": false
  }
}
```

`ipaPath` and `build` are optional. `build.scheme`, `build.configuration`, and `build.skipPolling` are passed directly to the blitzing build and upload tools.

**Success response (`200`):**

```json
{
  "gate": "passed",
  "scan": {
    "passed": true,
    "summary": { "total": 3, "critical": 0, "warns": 1, "infos": 2, "elapsed": 2.3 },
    "findings": []
  },
  "build": {
    "signing": "Signing configured for team XXXXXXXXXX",
    "build": "Archive succeeded: MyApp-2.2.0.xcarchive",
    "upload": "Build 2.2.0 (42) uploaded and processing"
  }
}
```

**Blocked response (`422`) — scan failed:**

```json
{
  "gate": "blocked",
  "scan": { "passed": false, "summary": { "critical": 1, ... }, "findings": [...] },
  "message": "Submission blocked: resolve critical findings first"
}
```

**Blitz.app not running (`503`) — scan passed but build could not start:**

```json
{
  "gate": "passed",
  "scan": { "passed": true, "summary": { "critical": 0, ... }, "findings": [] },
  "error": "Blitz.app is not running — scan passed but build could not start"
}
```

The `gate: "passed"` and `scan` are always included in the `503` response so the caller knows the compliance check succeeded and can display the scan result independently.

**Example:**

```bash
curl -s -X POST http://localhost:3847/api/modules/pipeline/submit \
  -H "Content-Type: application/json" \
  -d '{
    "sourcePath": "/Users/me/dev/MyApp",
    "build": {
      "scheme": "MyApp",
      "configuration": "Release"
    }
  }' | jq .
```

---

## Error reference

| Status | Meaning |
|---|---|
| `400` | `sourcePath` missing from request body |
| `422` | Scan completed — critical findings block submission |
| `503` | Scan passed, but Blitz.app is not running (`/submit` only) or `green-means-go` not available |
| `504` | Scan timed out (`GREENMEANSGO_TIMEOUT_MS` exceeded) |
| `500` | Scanner exited with error |
| `502` | Blitz.app returned an unexpected error during build |

---

## What happens when Blitz.app is not running

For `/scan-gate`: no change — the route only invokes `green-means-go` and does not require Blitz.app.

For `/submit`: the preflight scan runs to completion. If the scan passes and Blitz.app is not reachable when the build step begins, the route returns `503` with the following shape:

```json
{
  "gate": "passed",
  "scan": { ... },
  "error": "Blitz.app is not running — scan passed but build could not start"
}
```

This lets the caller distinguish between a compliance failure (`422`, `gate: "blocked"`) and an infrastructure failure (`503`, `gate: "passed"`).
