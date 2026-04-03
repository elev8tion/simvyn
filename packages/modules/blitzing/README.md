# blitzing

App Store submission proxy module for simvyn. Bridges the simvyn HTTP server to Blitz.app over a local Unix socket, exposing all 34 Blitz tools as REST endpoints.

---

## Requirement

**Blitz.app must be running and connected to an Xcode project** before any route will succeed. If the socket is not present at startup, a warning is logged but the module still loads — all routes will return `503` until Blitz.app starts.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `BLITZSOCKETPATH` | `/tmp/blitz-mcp-<uid>.sock` | Path to the Blitz.app Unix domain socket. Override when running Blitz.app under a different user or in a non-standard location. |

Example:

```bash
BLITZSOCKETPATH=/tmp/blitz-mcp-501.sock npx simvyn start
```

---

## Routes

All routes are mounted at `/api/modules/blitzing`. A `503` from any route means Blitz.app is not reachable; a `504` means the connection timed out; a `400` means Blitz.app rejected the tool arguments.

---

### App state

| Method | Path | Tool | Description |
|---|---|---|---|
| GET | `/app-state/state` | `app_get_state` | Return current Blitz.app state |
| GET | `/app-state/screenshot` | `get_blitz_screenshot` | Capture a screenshot of the Blitz.app window |
| GET | `/app-state/tabs` | `nav_list_tabs` | List available navigation tabs |
| GET | `/app-state/rejection` | `get_rejection_feedback` | Fetch rejection feedback (optional `?version=` query param) |
| POST | `/app-state/tab` | `get_tab_state` | Get state of a specific tab |
| POST | `/app-state/nav` | `nav_switch_tab` | Switch the active tab |

**Examples:**

```bash
# Get current app state
curl -s http://localhost:3847/api/modules/blitzing/app-state/state | jq .

# Switch to the "metadata" tab (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/app-state/nav \
  -H "Content-Type: application/json" \
  -d '{"tab": "metadata"}' | jq .

# Get rejection feedback for a specific version
curl -s "http://localhost:3847/api/modules/blitzing/app-state/rejection?version=2.1.0" | jq .
```

---

### Projects

| Method | Path | Tool | Description |
|---|---|---|---|
| GET | `/projects/` | `project_list` | List all Xcode projects known to Blitz.app |
| GET | `/projects/active` | `project_get_active` | Get the currently active project |
| POST | `/projects/open` | `project_open` | Open a project by ID |
| POST | `/projects/create` | `project_create` | Create a new project |
| POST | `/projects/import` | `project_import` | Import an existing Xcode project from disk |
| DELETE | `/projects/active` | `project_close` | Close the active project |

**Examples:**

```bash
# List all projects
curl -s http://localhost:3847/api/modules/blitzing/projects/ | jq .

# Open a project (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/projects/open \
  -H "Content-Type: application/json" \
  -d '{"projectId": "com.example.MyApp"}' | jq .

# Import from disk (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/projects/import \
  -H "Content-Type: application/json" \
  -d '{"path": "/Users/me/dev/MyApp/MyApp.xcodeproj", "type": "xcode"}' | jq .
```

---

### Simulator

| Method | Path | Tool | Description |
|---|---|---|---|
| GET | `/simulator/devices` | `simulator_list_devices` | List available simulators |
| POST | `/simulator/select` | `simulator_select_device` | Select the active simulator by UDID |

**Examples:**

```bash
# List simulators
curl -s http://localhost:3847/api/modules/blitzing/simulator/devices | jq .

# Select a device (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/simulator/select \
  -H "Content-Type: application/json" \
  -d '{"udid": "ABCD1234-..."}' | jq .
```

---

### Settings

| Method | Path | Tool | Description |
|---|---|---|---|
| GET | `/settings/` | `settings_get` | Read current Blitz.app settings |
| PATCH | `/settings/` | `settings_update` | Update one or more settings fields |
| POST | `/settings/save` | `settings_save` | Persist settings to disk |

**Examples:**

```bash
# Read settings
curl -s http://localhost:3847/api/modules/blitzing/settings/ | jq .

# Update cursor size (requires NSAlert confirmation in Blitz.app)
curl -s -X PATCH http://localhost:3847/api/modules/blitzing/settings/ \
  -H "Content-Type: application/json" \
  -d '{"showCursor": true, "cursorSize": 2}' | jq .

# Save (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/settings/save | jq .
```

---

### Credentials

| Method | Path | Tool | Description |
|---|---|---|---|
| POST | `/credentials/` | `asc_set_credentials` | Configure App Store Connect API key |
| POST | `/credentials/web-auth` | `asc_web_auth` | Initiate browser-based App Store Connect login |

**Examples:**

```bash
# Set API key credentials (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/credentials/ \
  -H "Content-Type: application/json" \
  -d '{
    "issuerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "keyId": "XXXXXXXXXX",
    "privateKeyPath": "/Users/me/.private_keys/AuthKey_XXXXXXXXXX.p8"
  }' | jq .

# Trigger web auth flow (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/credentials/web-auth | jq .
```

---

### Forms

| Method | Path | Tool | Description |
|---|---|---|---|
| POST | `/forms/fill` | `asc_fill_form` | Fill fields on the active App Store Connect form tab |
| POST | `/forms/localization` | `store_listing_switch_localization` | Switch the active localization in the store listing |

**Examples:**

```bash
# Fill the "description" field on the "metadata" tab (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/forms/fill \
  -H "Content-Type: application/json" \
  -d '{
    "tab": "metadata",
    "locale": "en-US",
    "fields": {
      "description": "The best app ever.",
      "keywords": "productivity,tools"
    }
  }' | jq .

# Switch localization (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/forms/localization \
  -H "Content-Type: application/json" \
  -d '{"locale": "fr-FR"}' | jq .
```

---

### Versions

| Method | Path | Tool | Description |
|---|---|---|---|
| POST | `/versions/select` | `asc_select_version` | Select a version in the App Store Connect sidebar |
| POST | `/versions/` | `asc_create_version` | Create a new app version |
| POST | `/versions/submit-preview` | `asc_open_submit_preview` | Open the submission review preview panel |

**Examples:**

```bash
# Select version (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/versions/select \
  -H "Content-Type: application/json" \
  -d '{"version": "2.1.0"}' | jq .

# Create version (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/versions/ \
  -H "Content-Type: application/json" \
  -d '{
    "versionString": "2.2.0",
    "copyFromVersion": "2.1.0",
    "copyMetadata": true,
    "copyReviewDetail": true
  }' | jq .

# Open submit preview (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/versions/submit-preview | jq .
```

---

### Screenshots

| Method | Path | Tool | Description |
|---|---|---|---|
| POST | `/screenshots/localization` | `screenshots_switch_localization` | Switch screenshot localization |
| POST | `/screenshots/asset` | `screenshots_add_asset` | Add a screenshot image to the asset library |
| POST | `/screenshots/slot` | `screenshots_set_track` | Assign an asset to a display slot |
| POST | `/screenshots/save` | `screenshots_save` | Save the current screenshot set |

**Examples:**

```bash
# Switch localization (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/screenshots/localization \
  -H "Content-Type: application/json" \
  -d '{"locale": "ja-JP"}' | jq .

# Add screenshot asset (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/screenshots/asset \
  -H "Content-Type: application/json" \
  -d '{"sourcePath": "/Users/me/screenshots/home-6.7.png", "fileName": "home-6.7.png"}' | jq .

# Assign to slot 0 (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/screenshots/slot \
  -H "Content-Type: application/json" \
  -d '{"assetFileName": "home-6.7.png", "slotIndex": 0, "displayType": "APP_IPHONE_67"}' | jq .

# Save (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/screenshots/save | jq .
```

---

### Monetization

| Method | Path | Tool | Description |
|---|---|---|---|
| POST | `/monetization/iap` | `asc_create_iap` | Create an in-app purchase product |
| POST | `/monetization/subscription` | `asc_create_subscription` | Create a subscription product |
| POST | `/monetization/price` | `asc_set_app_price` | Set the base app price tier |

**Examples:**

```bash
# Create IAP (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/monetization/iap | jq .

# Create subscription (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/monetization/subscription | jq .

# Set price (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/monetization/price \
  -H "Content-Type: application/json" \
  -d '{"price": "4.99", "effectiveDate": "2026-05-01"}' | jq .
```

---

### Build pipeline

| Method | Path | Tool | Description |
|---|---|---|---|
| POST | `/build/signing` | `app_store_setup_signing` | Configure code signing for the project |
| POST | `/build/` | `app_store_build` | Archive the app for distribution |
| POST | `/build/upload` | `app_store_upload` | Upload the archive to App Store Connect |

**Examples:**

```bash
# Configure signing (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/build/signing \
  -H "Content-Type: application/json" \
  -d '{"teamId": "XXXXXXXXXX"}' | jq .

# Build (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/build/ \
  -H "Content-Type: application/json" \
  -d '{"scheme": "MyApp", "configuration": "Release"}' | jq .

# Upload (requires NSAlert confirmation in Blitz.app)
curl -s -X POST http://localhost:3847/api/modules/blitzing/build/upload \
  -H "Content-Type: application/json" \
  -d '{"skipPolling": false}' | jq .
```

---

## Approval categories

Blitz.app shows an **NSAlert confirmation dialog** before executing any tool that mutates state. The following routes trigger a confirmation prompt:

**All POST, PATCH, and DELETE routes** require approval. Read-only GET routes do not.

Routes that **do not** require confirmation (GET only):

- `GET /app-state/state`
- `GET /app-state/screenshot`
- `GET /app-state/tabs`
- `GET /app-state/rejection`
- `GET /projects/`
- `GET /projects/active`
- `GET /simulator/devices`
- `GET /settings/`

All other routes (`POST`, `PATCH`, `DELETE`) require the user to approve the action in Blitz.app before the tool executes. Automated pipelines should account for this — use the pipeline module for headless submission flows.
