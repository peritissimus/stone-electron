# Stone web

Stone can run its existing renderer and a headless HTTP server without starting
Electron. The server reuses the existing application use cases and persistence
adapters; HTTP is a second inbound adapter alongside IPC.

## Web-backed features

- Notes: create, read, edit, delete, move, favorite, pin, archive, and filter
- Notebooks: list, create, rename, move, and delete
- Tags: list, create, delete, add to notes, and remove from notes
- Search: full-text, plus real semantic and hybrid search backed by the embedding worker
- Topics: semantic search, embedding status, and initialization
- Indexing: chunk statistics, per-note indexing, and full rebuilds
- AI: ask-notes, note summaries, and link suggestions
- Status reports and daily-review summaries
- Tasks: aggregate Logseq-style tasks and update their workflow state
- Journals: list recent dates and open or create entries
- Knowledge graph: wikilink indexing, backlinks, forward links, and graph data
- Version history: create, list, and restore note snapshots
- Attachments: paste/upload images, list attachments, retrieve bytes, and delete
- Quick notes and quick capture, including voice capture transcription
- Templates: list and create notes from them
- Export: Markdown and HTML download; PDF via the browser's own print dialog
- Folders: create, rename, move, and delete inside the workspace
- Git: status, history, init, commit, pull, push, sync, and remote configuration
- Database maintenance: status, vacuum, and integrity check
- Meetings: record in the browser, upload, transcribe, summarize, re-transcribe,
  re-summarize, send to journal, play back, and delete
- Live push over server-sent events, so open tabs stay in step with each other
- Performance diagnostics for the server process
- Persistent appearance, editor, shortcut, onboarding, AI, meeting, and integration settings
- AI provider credentials encrypted at rest with AES-GCM and mode-0600 key files
- Workspace tree and Today/recent-notes views

The browser compatibility bridge only replaces the Electron transport. Stone's
components, editor, navigation, and styles are unchanged.

## Browser-native behavior

Some desktop capabilities have no server equivalent, so the bridge answers them
in the browser rather than pretending the server can act on the user's machine:

- Fonts come from the Local Font Access API, falling back to a web-safe list
- Microphone permission uses the browser's own permission prompt
- `openExternal` opens http(s) links in a new tab; OS deep links are refused
- Scratch files use the File System Access API (Chromium-based browsers)
- Export writes through a normal download; PDF uses the print dialog
- System-audio capture, OS-global shortcuts, and native folder pickers are
  unavailable — the workspace is configured administratively on the server

## Not available over HTTP

- Calendar and mail integrations, which read from the user's own machine
- Tray state and OS-global shortcuts, which have no browser equivalent
- System-audio capture. The desktop app records the mic and system audio as two
  tracks; a browser can only offer `getDisplayMedia`, which prompts and is
  limited to a tab or window, so browser recordings are mic-only in practice.

## Requirements beyond the database

Semantic search and voice capture need local model assets. Both are shared with
the desktop app when `STONE_CONFIG_PATH` points at the same config directory, so
nothing is downloaded twice:

- `pnpm build:worker` must have run so `dist/main/workers/embedding.worker.cjs`
  exists; the server spawns it as a plain Node worker thread
- The embedding model cache lives in `<config dir>/ml-cache`
- Whisper models live in `<config dir>/whisper-models`. Both `whisper-cli` (batch
  transcription) and `whisper-server` (live drafts) must exist in
  `vendor/whisper/bin` — run `pnpm build:whisper` if they are missing, or point
  at them with `STONE_WHISPER_BINARY` / `STONE_WHISPER_SERVER_BINARY`
- Recording uploads are large — roughly 1.9 MB per minute per track — so the
  server accepts bodies up to 512 MB. Size any reverse proxy to match.
- Git operations that reach a remote (pull/push/sync) rely on ambient
  credentials — an SSH agent or credential helper available to the server
  process. Without them they fail fast rather than prompting.

## Development

Install dependencies, then start both processes:

```bash
pnpm install
pnpm web:dev-stack
```

Open <http://localhost:5173>. Vite sends every `/api/*` request to the notes
server at `http://127.0.0.1:3000`.

The default development data lives under:

```text
data/
├── notes.db
├── config.json
└── workspace/
```

Override those locations when needed:

```bash
DATABASE_URL=/absolute/path/to/notes.db \
STONE_WORKSPACE_PATH=/absolute/path/to/workspace \
STONE_CONFIG_PATH=/absolute/path/to/config.json \
pnpm server:dev
```

To point the development proxy at another server:

```bash
VITE_DEV_API_URL=http://192.168.1.20:3000 pnpm web:dev
```

## Production

Build the server and web frontend:

```bash
pnpm build:web-stack
```

Run the resulting server:

```bash
STONE_DATA_DIR=/var/lib/stone \
STONE_HOST=127.0.0.1 \
STONE_PORT=3000 \
pnpm web:start
```

The Node process serves both surfaces from one origin:

```text
GET /             browser frontend
GET /capture      quick capture (see below)
GET /api/health   health check
GET /api/notes    notes API
GET /api/search   full-text search
GET /api/notebooks
GET /api/tags
GET /api/tasks
GET /api/journals
GET /api/graph
```

Keep `STONE_HOST=127.0.0.1` behind an HTTPS reverse proxy or private network.
The first slice is deliberately single-user and does not include public
internet authentication. Do not bind it to a public interface until
authentication and authorization are added.

Persist and back up both the database and workspace directory. Note metadata
lives in SQLite while note content lives in Markdown files.

## Quick capture

`/capture` is a second, separate entry point: a single box that appends a
timestamped line to today's journal.

It shares nothing with the web client but the API. The full frontend is roughly
7 MB — an editor, a graph renderer and a maths typesetter — and none of it helps
someone jotting one line from a phone, so the capture page is a self-contained
12 KB HTML file with no framework, no external asset and one request. It is
built from `capture.html` at the repo root as a second Vite entry, and Fastify
routes `/capture` to it ahead of the frontend's catch-all.

It posts to a single endpoint:

```text
POST /api/quick-capture/journal   {"text": "..."}  →  {"noteId", "appended"}
```

`appended` distinguishes an entry added to an existing day from one that
created the day's note; both are success. Empty or whitespace-only text is
rejected with `400 VALIDATION_ERROR` rather than writing a bare timestamp, and
the page keeps what you typed until the write is confirmed, so a failed request
costs a retry rather than the thought.

On iOS, Share → *Add to Home Screen* gives it an icon and opens it without
browser chrome.

## Environment variables

The server reads a `.env` from its working directory on startup, so the table
below can live in a file rather than in the command that launches it.
`.env.example` at the repo root lists every variable with its default; copy it
to `.env` to get started. Values already present in the environment win, which
is what lets a process manager override a single setting without editing the
file.

| Variable               | Default                       | Purpose                        |
| ---------------------- | ----------------------------- | ------------------------------ |
| `STONE_DATA_DIR`       | `./data`                      | Default parent for server data |
| `DATABASE_URL`         | `$STONE_DATA_DIR/notes.db`    | SQLite database path           |
| `STONE_WORKSPACE_PATH` | `$STONE_DATA_DIR/workspace`   | Markdown workspace             |
| `STONE_CONFIG_PATH`    | `$STONE_DATA_DIR/config.json` | Server-side app config         |
| `STONE_WEB_DIST`       | `./dist/web`                  | Compiled frontend directory    |
| `STONE_HOST`           | `127.0.0.1`                   | Server bind address            |
| `STONE_PORT`           | `3000`                        | Server port                    |
| `STONE_SECRET_KEY`     | generated local key          | Credential encryption secret   |
| `STONE_ML_CACHE_DIR`   | `<config dir>/ml-cache`       | Embedding model cache          |
| `STONE_EMBEDDING_WORKER` | `./dist/main/workers/embedding.worker.cjs` | Embedding worker bundle |
| `STONE_WHISPER_MODEL_DIR` | `<config dir>/whisper-models` | Whisper ggml models         |
| `STONE_WHISPER_BINARY` | bundled/dev path              | whisper-cli override           |
| `STONE_WHISPER_SERVER_BINARY` | bundled/dev path       | whisper-server override        |
| `STONE_LOG_LEVEL`      | `info`                        | `error`/`warn`/`info`/`debug`  |
| `VITE_API_BASE_URL`    | empty                         | Optional browser API origin    |
| `VITE_DEV_API_URL`     | `http://127.0.0.1:3000`       | Development proxy target       |

Successful operations log at `debug` and only surface at `info` when they run
long, so a quiet log is the expected state. Raise `STONE_LOG_LEVEL` to `debug`
to follow a single request through the layers.
