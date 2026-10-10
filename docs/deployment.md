# Deploying Stone's server

For reaching your own notes from your own phone: the server runs on your Mac,
Cloudflare Tunnel publishes it without opening a port, and Cloudflare Access
decides who gets through.

This is the single-user shape Stone is designed for. Nothing here supports
multiple accounts, and the app has no authentication of its own — Access is the
security boundary. See [web-server.md](web-server.md) for what the server does;
this document is only about running it.

---

## The one thing that must not be skipped

**A bare tunnel is public.** `cloudflared` alone publishes your notes to the
entire internet. It hides your IP address and removes port forwarding; it is not
an access control.

The API is unauthenticated and offers 88 routes on the same origin as the
frontend, including:

```text
GET    /api/notes                        every note
GET    /api/notes/:id/content            full text of any note
GET    /api/meetings/:id/audio/:channel  raw meeting recordings
DELETE /api/notes/:id                    destroy any note
```

Nobody needs the UI to reach those. A limited page is not a limited surface.

So create the Access policy **before** the tunnel serves traffic, not after.

---

## 1. Build

```bash
pnpm install
pnpm build:web-stack
```

That produces three things the server needs: `dist/server/standalone.mjs`,
`dist/web/` (frontend and capture page), and
`dist/main/workers/embedding.worker.cjs` (semantic search — the server starts
without it and then fails at search time).

## 2. Configure

```bash
cp .env.example .env
```

Set at least `STONE_WORKSPACE_PATH` to your notes directory. Leave
`STONE_HOST=127.0.0.1`: the tunnel connects to the server locally, so the server
never needs to listen on a public interface.

Check it runs before going further:

```bash
pnpm web:start
curl http://127.0.0.1:3000/api/health
```

## 3. Keep it running (launchd)

On macOS this is a LaunchAgent, not systemd. It starts the server at login and
restarts it if it exits.

Create `~/Library/LaunchAgents/com.stone.server.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>              <string>com.stone.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>dist/server/standalone.mjs</string>
  </array>
  <!-- The server reads .env from its working directory, so configuration
       stays in the file rather than being duplicated into this plist. -->
  <key>WorkingDirectory</key>   <string>/Users/YOU/projects/stone</string>
  <key>RunAtLoad</key>          <true/>
  <key>KeepAlive</key>          <true/>
  <key>StandardOutPath</key>    <string>/tmp/stone-server.log</string>
  <key>StandardErrorPath</key>  <string>/tmp/stone-server.err</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.stone.server.plist
launchctl list | grep stone
```

Use absolute paths throughout — launchd inherits none of your shell's
environment, including `PATH`.

Two caveats worth knowing before you rely on this:

- A LaunchAgent runs when **you** are logged in. Log out and the server stops.
  A LaunchDaemon runs regardless but as root, which is the wrong owner for your
  notes; staying logged in is the simpler answer.
- The Mac must be awake. In System Settings → Battery / Energy Saver, enable
  _Prevent automatic sleeping_ — otherwise capture fails whenever the lid is
  shut, and you find out only when a thought is already gone.

## 4. Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create stone
cloudflared tunnel route dns stone stone.example.com
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: stone
credentials-file: /Users/YOU/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: stone.example.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

```bash
cloudflared tunnel run stone
```

Once it works, `cloudflared service install` keeps it running the same way the
LaunchAgent does for the server.

## 5. Access — the actual security boundary

In the Cloudflare Zero Trust dashboard:

1. **Access → Applications → Add an application → Self-hosted**
2. Domain: `stone.example.com`, path empty so the policy covers **everything**,
   API included.
3. Policy: _Allow_, with an **Emails** rule listing only your own address.
4. Choose a login method. One-time PIN to email needs no setup; an identity
   provider is nicer if you already have one, and can enforce passkeys.
5. Set a long session duration (a month) so the phone rarely re-authenticates.

Verify from a browser you are not signed into — a private window is enough. You
should get Cloudflare's login screen, and `curl https://stone.example.com/api/notes`
should return Access's HTML challenge rather than your notes.

## 6. The phone

Open `https://stone.example.com/capture`, sign in once, then Share →
_Add to Home Screen_. It opens without browser chrome and the Access cookie
persists, so capture stays two taps.

The full app is at `https://stone.example.com/` — usable on a phone, but it is
a desktop layout and was not designed for one.

---

## Limits to plan around

Cloudflare's edge imposes three constraints the server does not.

| Cloudflare                     | Stone                             | Effect                                                                                                                                 |
| ------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 100 MB request body (Free/Pro) | `bodyLimit` is 512 MB             | Meeting audio is 16 kHz mono WAV at ~32 KB/s, so roughly 52 minutes per channel hits the cap.                                          |
| Access sessions expire         | `EventSource` reconnects silently | On expiry the SSE reconnect receives a login redirect instead of a stream, and live updates stop without saying so. Reload to recover. |

Capture, notes, search and journals are unaffected. Verify the numbers against
your current plan — Cloudflare adjusts them.

### Long requests (handled)

Cloudflare answers **524** when an origin sends nothing for ~100 s, and
generation over a whole window routinely takes longer. The limit applies to
time-to-first-byte rather than total duration, so `POST /api/status-report` and
`POST /api/ai/actions/ask-notes` begin responding immediately and emit
whitespace until the payload is ready — measured at 6 ms to first byte for work
taking 3 s. Whitespace is legal between JSON tokens, so callers parse the result
unchanged.

One consequence worth knowing when reading these two routes: the status line is
committed before the outcome is known, so a failure arrives as `200` with an
error envelope in the body carrying the status it would have had. `apiFetch`
turns that back into a thrown error.

## Backups

Two things, and both are needed:

- **The workspace** — your Markdown. The source of truth. Stone treats Git as
  the sanctioned way to keep this safe and mirrored across machines.
- **The database** — `notes.db`. It is an index over the Markdown and can be
  rebuilt, but rebuilding means re-embedding every note.

  The database runs in WAL mode, so while the server is up its recent writes
  live in a `notes.db-wal` sidecar. Copying `notes.db` alone from a running
  server yields a file that is missing them. Either stop the server first, or
  let SQLite take a consistent snapshot of the live database:

  ```bash
  sqlite3 notes.db ".backup notes-backup.db"
  ```

`config.json` holds your settings and encrypted provider keys. If
`STONE_SECRET_KEY` is set, back it up separately — without it the stored keys
cannot be decrypted.

## Signed macOS releases

Desktop releases require macOS 14 or later because the updated ONNX native
runtime requires it. The bundled transcription binaries also target macOS 14;
their build cache is invalidated when the pinned source, architecture, or target changes.
The macOS/Linux startup paths disable ONNX diagnostic telemetry before native
initialization. Model downloads still contact the configured model host.

Local packages use the ad-hoc signing configuration. For Developer ID distribution,
run `pnpm build` followed by `pnpm package:signed`. This uses
`electron-builder.signed.yml`, requires a real signing identity, enables hardened
runtime, and notarizes the result. It fails instead of falling back to unsigned
artifacts. Packaging never publishes automatically.

Configure `CSC_NAME` (the Developer ID Application identity), `CSC_LINK` (the
certificate), and `CSC_KEY_PASSWORD`, plus either:

- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`; or
- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`.

Keep these values in local environment variables or CI secrets, never repository
files. The preflight check prints only missing variable names. Signing and
notarization require the project's Apple Developer credentials; the config alone
does not make an ad-hoc release notarized. Verify a signed artifact with
`codesign --verify --deep --strict` and `xcrun stapler validate` before distribution.

For CI, set repository variable `STONE_SIGNED_RELEASES=true` and configure the
same names as repository secrets. The release workflow then requires successful
signed packaging and verification before publishing that exact artifact.
For API-key notarization, the local `APPLE_API_KEY` value is the path to the `.p8`
file; the CI secret of that name contains the file's PEM text. The workflow writes
it to a temporary file readable only by the runner account and deletes that file
when the signing step exits.

## Local retrieval regression check

Run `pnpm eval:retrieval` after changing the embedding runtime or model. This
uses the production worker with a versioned synthetic English corpus and writes
Recall@3, mean reciprocal rank, and warm embedding time to
`test-results/retrieval-eval.json`. It checks finite, nonzero 384-dimensional
vectors and fails below Recall@3 0.875 or MRR 0.75. These are smoke-test thresholds,
not a claim about production search or generated answer quality.

The check also verifies distinct finite cross-encoder scores and reranker MRR
of at least 0.75. The first run downloads the existing BGE and MiniLM reranker
models into `.cache/retrieval-eval/models`;
no user notes or cloud text provider are used. `STONE_EVAL_CACHE` can select another
cache and `STONE_EVAL_WORKER` can point to the unpacked worker in a packaged app.
