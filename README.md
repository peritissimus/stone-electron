<p align="center">
  <img src="build/icon.png" alt="Stone icon" width="120" height="120" />
</p>

<h1 align="center">Stone</h1>

<p align="center">
  <strong>A local-first desktop workspace for notes, journals, meetings, and project memory.</strong>
</p>

<p align="center">
  <a href="#who-it-is-for">Who it is for</a> |
  <a href="#what-it-does">What it does</a> |
  <a href="#privacy-and-security">Privacy</a> |
  <a href="#install">Install</a> |
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.7.0-blue.svg" alt="Version 0.7.0" />
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey.svg" alt="macOS" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT license" />
</p>

---

<!-- TODO: add a product screenshot or short GIF here — it is the single
     highest-leverage thing this README is missing. Drop it under docs/ and
     reference it: <p align="center"><img src="docs/screenshot.png" ... /></p> -->

**Stone keeps your working memory in plain files you own.** It is a desktop app for Markdown notes, daily journals, tasks, meeting records, and semantic search — your workspace is just a folder on disk. Stone wraps it in a fast editor, local search indexes, Git-friendly history, and optional AI, without turning your notes into a hosted service.

## Who It Is For

Stone is built for:

- Developers and technical leads who want project notes, meeting context, and decisions in plain text.
- Researchers, founders, and operators who keep a daily work journal and need to recover context quickly.
- People who like tools such as Obsidian, Logseq, and Notion, but want a native local workspace with stronger file ownership.

It is not the right fit if you need multiplayer editing, mobile apps, or a hosted team wiki.

## What It Does

Three things set Stone apart:

- **Your notes are just files.** Plain Markdown in a folder you own. SQLite holds only metadata and indexes, which can be rebuilt from the files at any time.
- **Capture stays local.** Meetings and voice notes transcribe on-device with Whisper (large-v3-turbo) — on macOS, system audio is captured alongside your mic, with acoustic echo cancellation so the two tracks stay clean. Recording audio is yours: keep it, replay it, re-transcribe it, or set it to auto-delete on your own schedule.
- **Retrieval you control.** Full-text and semantic search, topic clustering, a link graph, and related-note scoring all run on your machine. AI is optional and sits behind it, never in front of your data.

Stone is organized around six places — **Today**, **Journals**, **Tasks**, **Knowledge**, **Graph**, and **Meetings** — and a command palette (`Cmd+K`) that jumps to any of them, any note, or any action.

### Today

Your landing page: current journal, meetings, tasks, recent edits, and "on this day" context in one view. It answers a single question — what am I working from right now? — and can spin your recent activity into a shareable status report.

### Notes and editing

- Rich TipTap editor: headings, lists, quotes, code blocks, links, tables, images, and Mermaid diagrams that render inline.
- Slash commands for structure; templates for note shapes you reuse.
- Raw Markdown remains the durable storage format.

### Journals and tasks

- Daily journals are a primary surface, not a plugin.
- Tasks are pulled from across your notes into one view, with states for real workflows: `TODO`, `DOING`, `DONE`, `WAITING`, `HOLD`, `CANCELED`, `IDEA`.
- Journals, notes, and meeting records all feed the same workspace memory.

### Meetings and voice notes

- Record a meeting inline, or grab a quick thought from a floating capture window.
- **Fully local transcription** with Whisper `large-v3-turbo` + Silero VAD — strong on multilingual and code-switched speech.
- **Two-speaker capture on macOS:** your mic ("You") and system audio ("Others") are recorded as separate tracks and interleaved into one speaker-labelled transcript.
- **Real acoustic echo cancellation** (DTLN, ONNX) scrubs speaker bleed out of the mic track before transcription, so on speakers your side isn't polluted by the other side.
- **Live draft** while you record (resident Whisper server), then a clean, speaker-separated transcript when you finalize.
- **Audio playback** with click-to-seek transcript turns that follow along as it plays.
- **Confidence-aware summaries:** per-segment transcription confidence and loop/garbage markers are fed to the summary prompt so it discounts shaky lines instead of stating them as fact.
- **Re-transcribe** from kept audio (e.g. after a model upgrade), **re-summarize**, and **copy** the whole transcript.
- **Configurable retention:** keep recording audio indefinitely, delete it right after transcription, or auto-delete after N days (default 30) — transcript and summary are always kept.
- Review the summary, then send it into your journal when you choose.

### Find and connect

- Full-text search for exact recall; semantic search for rediscovering nearby work.
- **Knowledge** clusters your workspace into topics, so you can see what you actually write about.
- **Graph** shows how notes link together.
- Related-note scoring blends embeddings, lexical overlap, shared tags, and link structure — calibrated to your own workspace, so it works without relying on embeddings alone.
- Smart link suggestions surface notes worth connecting as you write.

### Git and AI

- Initialize, commit, pull, push, and sync from inside Stone, with honest conflict and error reporting. The workspace stays a normal repository — no lock-in.
- **Ask Notes** answers questions grounded in your workspace and cites the source notes. Embeddings, reranking, and transcription run locally; text generation (Ask Notes, summaries, status reports, link suggestions) is configurable across **OpenAI, Azure OpenAI, Google, and Groq** — including a custom OpenAI base URL for proxies and self-hosted endpoints. Cloud inference is off by default and gated per privacy setting; note content never leaves the machine unless you opt in.

## Privacy and Security

Stone is local-first by default — no account, no Stone cloud backend, no telemetry. Your notes never leave your machine unless you put them somewhere yourself (Git, a backup, a synced folder). External AI providers are opt-in and apply only to the features you configure.

The app is hardened against the usual Electron risks:

- Renderer windows run with `nodeIntegration: false` and `contextIsolation: true`.
- IPC channels are validated at the app boundary.
- Foreign navigation and `window.open` are denied; external links open in your system browser.
- The production dependency tree audits clean with `pnpm audit --prod`.

## Install

Download the latest macOS build from GitHub:

[github.com/peritissimus/stone-electron/releases/latest](https://github.com/peritissimus/stone-electron/releases/latest)

Current release artifacts are macOS DMG and ZIP builds. Windows and Linux packaging targets exist in the project configuration, but release automation currently publishes macOS builds.

### First launch on macOS

Stone isn't notarized by Apple yet, so macOS blocks it the first time. To get past it once:

1. Drag Stone into **Applications**.
2. Right-click (or Control-click) Stone → **Open** → **Open** again.
3. If macOS only offers "Move to Trash," go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**.

Or clear the quarantine flag from a terminal and skip the prompts entirely:

```bash
xattr -dr com.apple.quarantine /Applications/Stone.app
```

## Development

### Prerequisites

- Node.js 20+
- pnpm 10.27.0 via Corepack
- macOS with Xcode Command Line Tools (to build the bundled whisper.cpp binary via `pnpm build:whisper`)

### Run Locally

```bash
git clone git@github.com:peritissimus/stone-electron.git stone
cd stone

corepack enable
pnpm install
pnpm dev
```

### Common Commands

```bash
pnpm dev              # Start Vite and Electron in development
pnpm build            # Build main, worker, preload, and renderer
pnpm build:whisper    # Build the bundled whisper.cpp binaries (one-time, for transcription)
pnpm package          # Package for the current platform
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint
pnpm test             # Unit and integration tests
pnpm test:e2e         # Build and run Playwright end-to-end tests
pnpm audit --prod     # Check shipped dependencies for known vulnerabilities
```

### Git hooks

`pnpm install` points Git at the tracked `.githooks/` directory. The `pre-commit`
hook runs [gitleaks](https://github.com/gitleaks/gitleaks) over staged changes and
blocks commits that contain secrets (API keys, tokens, private keys). Install
gitleaks (`brew install gitleaks`) to activate it; without it the hook no-ops with
a warning.

## Architecture

Stone is an Electron app with a hexagonal main process and a layered React renderer.

```text
src/
  main/
    domain/            pure entities, value objects, services, ports
    application/       use cases and DTOs
    adapters/          IPC, persistence, storage, integrations
    infrastructure/    DI, database setup, Electron bootstrap, workers
  renderer/
    api/               thin IPC wrappers
    stores/            Zustand state
    hooks/             React lifecycle and state composition
    components/        UI components
    pages/             route-level screens
  shared/              serializable cross-process types and channel constants
```

Core rule: dependencies point inward. Domain code has no external imports, use cases depend on ports, adapters implement ports, and infrastructure wires concrete implementations together.

## Tech Stack

| Area | Technology |
| --- | --- |
| Desktop | Electron |
| UI | React, TypeScript, Vite |
| Editor | TipTap / ProseMirror |
| Styling | Tailwind CSS, Radix primitives |
| State | Zustand |
| Storage | Markdown files, SQLite/libSQL, Drizzle ORM |
| Search | Full-text, local embeddings, workspace ranking |
| Transcription | whisper.cpp (large-v3-turbo) + Silero VAD, DTLN echo cancellation (ONNX Runtime) |
| AI | Vercel AI SDK — OpenAI, Azure, Google, Groq |
| Diagrams | Mermaid |
| Testing | Vitest, Playwright |
| Packaging | electron-builder |

## Status

Stone is actively developed and currently best tested on macOS. The file format is intentionally boring: Markdown files in folders, with local metadata and indexes that can be rebuilt.

## Contributing

Issues and pull requests are welcome. Before opening a larger change, read [CONTRIBUTING.md](CONTRIBUTING.md) and keep changes aligned with the architecture rules in [AGENTS.md](AGENTS.md).
