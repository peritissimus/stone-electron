# Stone - Development Guide for Claude

## Package Manager

This project uses **pnpm** (not npm or yarn).

## Essential Commands

### Running the App
```bash
pnpm dev:electron          # Run in development mode
pnpm start                 # Run production build
```

### Building
```bash
pnpm build                 # Build all (main, preload, renderer)
pnpm build:main            # Build main process
pnpm build:preload         # Build preload script
pnpm build:renderer        # Build renderer (UI)
```

### Dependencies
```bash
pnpm install               # Install all dependencies
pnpm postinstall           # Manually rebuild native modules
```

### shadcn/ui Components
```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add dialog select tabs input
```

## Project Structure

```
stone/
├── src/
│   ├── main/              # Electron main process
│   │   ├── database/      # SQLite database management
│   │   ├── ipc/           # IPC handlers
│   │   └── repositories/  # Data access layer
│   ├── renderer/          # React UI
│   │   ├── components/    # React components
│   │   │   ├── ui/        # shadcn components
│   │   │   ├── Layout/    # Main layout components
│   │   │   ├── Editor/    # TipTap editor
│   │   │   ├── Notebook/  # Notebook tree
│   │   │   ├── Tag/       # Tag management
│   │   │   └── Settings/  # Settings modal
│   │   ├── stores/        # Zustand state management
│   │   ├── hooks/         # React hooks
│   │   └── lib/           # Utility functions
│   ├── preload.ts         # Electron preload script
│   └── shared/            # Shared types and constants
├── migrations/            # Database migrations (SQL)
└── dist/                  # Build output

```

## Tech Stack

- **Framework**: Electron + React + TypeScript
- **UI**: 
  - shadcn/ui (Radix UI primitives)
  - Tailwind CSS (macOS-inspired design)
  - Lucide icons
- **Editor**: TipTap (rich text editor)
- **Database**: better-sqlite3
- **State**: Zustand
- **Build**: Vite

## Path Aliases

TypeScript and Vite are configured with these aliases:

```typescript
@/           → src/
@main/       → src/main/
@renderer/   → src/renderer/
@shared/     → src/shared/
```

## Design System

The app follows macOS design guidelines with:
- **Font**: SF Pro Display/Text (system fonts)
- **Colors**: Neutral grays with blue accent (#007AFF)
- **Border radius**: 10px (macOS-style)
- **Font size**: 13px base (macOS standard)

### CSS Variables
Available in both light and dark mode:
- `--background`, `--foreground`
- `--sidebar` (for sidebar background)
- `--primary`, `--primary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--border`, `--input`, `--ring`

## Native Modules

The project uses `better-sqlite3` which requires native compilation:

```bash
pnpm electron-rebuild -f -w better-sqlite3
```

This runs automatically via the `postinstall` script.

## Database

- **Location**: `~/Library/Application Support/Stone/stone-data/notes.db`
- **Migrations**: SQL files in `migrations/` directory
- **Format**: SQLite with FTS5 for full-text search

### Tables
- `notebooks` - Hierarchical notebook organization
- `notes` - Main notes with title, content, flags
- `tags` - Tags for categorization
- `note_tags` - Many-to-many relationship
- `attachments` - File attachments
- `note_versions` - Version history
- `notes_fts` - Full-text search (FTS5)

## Important Notes

1. **Always use pnpm**, not npm
2. **Path imports**: Use `@renderer/` prefix for renderer components
3. **Native modules**: Rebuild after installing new native deps
4. **Migrations**: Place in `migrations/` as `001_name.sql`
5. **macOS design**: Follow the existing design tokens and spacing

## Troubleshooting

### better-sqlite3 errors
```bash
rm -rf node_modules
pnpm install
pnpm electron-rebuild -f -w better-sqlite3
```

### Database issues
Delete and recreate: `rm ~/Library/Application\ Support/Stone/stone-data/notes.db`

### Build issues
```bash
pnpm build:main
pnpm build:preload
pnpm build:renderer
```
