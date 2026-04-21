<p align="center">
  <img src="assets/logo.svg" alt="Stone logo" width="120" height="120" />
</p>

<h1 align="center">Stone</h1>

<p align="center">
  <strong>A beautiful, local-first note-taking app for deep work</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#keyboard-shortcuts">Shortcuts</a> •
  <a href="#development">Development</a> •
  <a href="#tech-stack">Tech Stack</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.3.0-blue.svg" alt="Version" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
</p>

---

## Why Stone?

Stone is built for people who think in text. It combines the elegance of Notion with the speed of local-first apps, giving you a distraction-free environment for capturing ideas, writing documents, and organizing knowledge.

**Your notes stay yours.** Everything is stored as plain Markdown files on your computer—no cloud lock-in, no subscriptions, no tracking.

---

## Features

### Rich Editor

A powerful block-based editor inspired by Notion:

- **Slash Commands** — Type `/` to access headings, lists, code blocks, quotes, and more
- **Block Hover Actions** — Drag handles and quick-add buttons on every block
- **Smart Formatting** — Bold, italic, strikethrough, highlights, and inline code
- **Tables** — Full table support with easy editing
- **Images** — Drag and drop or paste images directly

### Mermaid Diagrams

Create beautiful diagrams right inside your notes:

```
graph TD
    A[Idea] --> B{Decision}
    B -->|Yes| C[Build it]
    B -->|No| D[Archive]
```

Supports flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams, Gantt charts, and more.

### Code Blocks

First-class support for developers:

- **Syntax Highlighting** — 20+ languages including TypeScript, Python, Rust, Go, and SQL
- **Custom Theme** — Beautiful colors that match the app's design system
- **Language Selector** — Easy dropdown to switch languages

### Task Management

Logseq-inspired task states for flexible workflows:

- `TODO` → `DOING` → `DONE`
- Additional states: `WAITING`, `HOLD`, `CANCELED`, `IDEA`
- Click task badges to cycle through states

### Daily Journal

Start each day with a fresh page:

- Automatically opens today's journal on launch
- Organized in a `Journal/` folder with date-based filenames
- Perfect for daily notes, standup logs, or morning pages

### Organization

Keep your knowledge structured:

- **Workspaces** — Multiple vaults for different projects or areas of life
- **Folders** — Hierarchical organization with drag-and-drop
- **Tags** — Cross-cutting categorization
- **Full-Text Search** — Find anything instantly

### Local-First

Your data, your rules:

- **Markdown Files** — Plain text that works everywhere
- **No Cloud Required** — Everything stays on your machine
- **Git-Friendly** — Version control your notes naturally
- **Fast** — No network latency, instant saves

### Beautiful Design

Crafted with attention to detail:

- **Typography** — Inter for UI, Barlow for content, SF Mono for code
- **Dark Mode** — System-aware with manual override
- **Notion-Inspired** — Clean, spacious, focused
- **Native Feel** — macOS-style scrollbars and interactions

---

## Installation

### Download

Download the latest release for your platform:

| Platform              | Download                                                                       |
| --------------------- | ------------------------------------------------------------------------------ |
| macOS (Apple Silicon) | [Latest release](https://github.com/peritissimus/stone/releases/latest)        |
| macOS (Intel)         | Coming soon                                                                    |
| Windows               | Coming soon                                                                    |
| Linux                 | Coming soon                                                                    |

### Build from Source

```bash
# Clone the repository
git clone https://github.com/peritissimus/stone.git
cd stone

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build && npm run package
```

Requires Node.js 20+ and npm.

---

## Keyboard Shortcuts

| Action         | macOS | Windows/Linux |
| -------------- | ----- | ------------- |
| Save note      | `⌘S`  | `Ctrl+S`      |
| New note       | `⌘N`  | `Ctrl+N`      |
| Open settings  | `⌘,`  | `Ctrl+,`      |
| Bold           | `⌘B`  | `Ctrl+B`      |
| Italic         | `⌘I`  | `Ctrl+I`      |
| Code           | `⌘E`  | `Ctrl+E`      |
| Link           | `⌘K`  | `Ctrl+K`      |
| Slash commands | `/`   | `/`           |

---

## Development

### Prerequisites

- Node.js 20+
- npm

### Scripts

```bash
npm run dev            # Start development mode
npm run build          # Build all (main, worker, preload, renderer)
npm run package        # Package for current platform
npm test               # Run unit tests
npm run test:e2e       # Run Cypress end-to-end tests
npm run typecheck      # TypeScript type checking
npm run lint           # ESLint
```

### Project Structure

```
stone/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── domain/              # Entities, ports, domain services
│   │   ├── application/         # Use cases and DTOs
│   │   ├── adapters/            # IPC, persistence, external integrations
│   │   ├── infrastructure/      # DI, database, workers, bootstrap
│   │   └── shared/              # Main-process shared utilities
│   ├── renderer/                # React UI
│   │   ├── api/                 # IPC client layer
│   │   ├── stores/              # Zustand state
│   │   ├── hooks/               # React hooks
│   │   ├── components/          # UI components
│   │   └── pages/               # Route-level pages
│   ├── shared/                  # Cross-process types/constants
│   └── preload.ts               # Electron preload bridge
├── tests/                       # Unit and integration tests
├── build/                       # Packaging resources and icons
└── dist/                        # Build and package output
```

### Architecture

Stone uses a **file-first architecture**:

- **Files** are the source of truth (Markdown on disk)
- **Database** stores metadata only (titles, timestamps, flags)
- **Editor** renders HTML, saves as Markdown
- **No content in DB** — fast list views, scalable storage

---

## Tech Stack

| Layer      | Technology            |
| ---------- | --------------------- |
| Framework  | Electron 33           |
| Frontend   | React 18 + TypeScript |
| Editor     | TipTap (ProseMirror)  |
| Styling    | Tailwind CSS 4        |
| Components | shadcn/ui (Radix)     |
| State      | Zustand               |
| Database   | SQLite (libsql)       |
| Diagrams   | Mermaid               |
| Build      | Vite                  |

---

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting a PR.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## License

MIT © [peritissimus](https://github.com/peritissimus)

---

<p align="center">
  <sub>Built with obsessive attention to detail.</sub>
</p>
