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
  *Prevent automatic sleeping* — otherwise capture fails whenever the lid is
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
3. Policy: *Allow*, with an **Emails** rule listing only your own address.
4. Choose a login method. One-time PIN to email needs no setup; an identity
   provider is nicer if you already have one, and can enforce passkeys.
5. Set a long session duration (a month) so the phone rarely re-authenticates.

Verify from a browser you are not signed into — a private window is enough. You
should get Cloudflare's login screen, and `curl https://stone.example.com/api/notes`
should return Access's HTML challenge rather than your notes.

## 6. The phone

Open `https://stone.example.com/capture`, sign in once, then Share →
*Add to Home Screen*. It opens without browser chrome and the Access cookie
persists, so capture stays two taps.

The full app is at `https://stone.example.com/` — usable on a phone, but it is
a desktop layout and was not designed for one.

---

## Limits to plan around

Cloudflare's edge imposes three constraints the server does not.

| Cloudflare | Stone | Effect |
| --- | --- | --- |
| 100 MB request body (Free/Pro) | `bodyLimit` is 512 MB | Meeting audio is 16 kHz mono WAV at ~32 KB/s, so roughly 52 minutes per channel hits the cap. |
| Access sessions expire | `EventSource` reconnects silently | On expiry the SSE reconnect receives a login redirect instead of a stream, and live updates stop without saying so. Reload to recover. |

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
