# Stone - AI Agent Guidelines

This document provides guidelines for AI assistants (like Claude) working on the Stone note-taking application.

## Core Principles

1. **Always use pnpm** - Never use npm or yarn
2. **Preserve macOS design** - Follow the established design system
3. **Use TypeScript path aliases** - `@renderer/`, `@main/`, `@shared/`
4. **Test changes** - Build and verify before marking tasks complete
5. **Document changes** - Update relevant docs when modifying architecture

## Development Workflow

### When Adding Features

1. **Plan first** - Use TodoWrite to break down complex tasks
2. **Read existing code** - Understand current patterns before adding new code
3. **Follow conventions** - Match existing code style and architecture
4. **Update components** - Use existing design tokens and Tailwind classes
5. **Test thoroughly** - Build main, preload, and renderer as needed

### When Fixing Bugs

1. **Investigate root cause** - Don't just patch symptoms
2. **Check logs** - Use the logger to understand what's failing
3. **Verify the fix** - Test in both light and dark mode
4. **Document the fix** - Explain what was wrong and how you fixed it

### When Refactoring

1. **Don't break existing features** - Ensure all functionality still works
2. **Maintain design consistency** - Keep the macOS aesthetic
3. **Update imports** - Use path aliases consistently
4. **Test native modules** - Rebuild if touching database code

## File Organization

### Where to Put Code

- **UI Components** → `src/renderer/components/`
  - shadcn/ui → `src/renderer/components/ui/`
  - Layout → `src/renderer/components/Layout/`
  - Feature-specific → `src/renderer/components/[Feature]/`

- **State Management** → `src/renderer/stores/`
  - One store per domain (notes, notebooks, tags, ui)

- **Database** → `src/main/database/`
  - Migrations → `migrations/` (root level, not in src)

- **IPC Handlers** → `src/main/ipc/handlers/`
  - One file per domain (noteHandlers.ts, notebookHandlers.ts)

- **Shared Types** → `src/shared/`
  - Constants → `src/shared/constants/`
  - Types → `src/shared/types/`

### Naming Conventions

- **Components**: PascalCase (e.g., `NoteEditor.tsx`)
- **Files**: camelCase (e.g., `noteHandlers.ts`)
- **Stores**: camelCase with "Store" suffix (e.g., `noteStore.ts`)
- **CSS classes**: Tailwind utilities (no custom CSS unless necessary)
- **Migrations**: `001_description.sql` (numbered, snake_case)

## Design System Rules

### Colors

Always use CSS variables, never hardcoded colors:

✅ **Good:**
```tsx
<div className="bg-background text-foreground border-border">
<button className="bg-primary text-primary-foreground">
<span className="text-muted-foreground">
```

❌ **Bad:**
```tsx
<div className="bg-white text-black border-gray-200">
<button className="bg-blue-600 text-white">
<span className="text-gray-500">
```

### Spacing

Follow macOS-style compact spacing:

- **Padding**: `p-2`, `p-3`, `p-4` (8px, 12px, 16px)
- **Gap**: `gap-1`, `gap-2`, `gap-3` (4px, 8px, 12px)
- **Text size**: `text-xs` (11px), `text-sm` (13px), `text-base` (14px)

### Border Radius

Use consistent rounded corners:

- **Small elements**: `rounded-md` (6px)
- **Buttons/inputs**: `rounded-lg` (10px)
- **Cards/modals**: `rounded-lg` or `rounded-xl`

### Typography

- **Body text**: `text-xs` or `text-sm`
- **Headings**: `text-base`, `text-lg`
- **Labels**: `text-xs font-medium`
- **Always** use `font-semibold` or `font-medium`, not `font-bold`

## Common Patterns

### Adding a New IPC Handler

1. Define channel in `src/shared/constants/ipcChannels.ts`
2. Create handler in `src/main/ipc/handlers/`
3. Register in `src/main/ipc/index.ts`
4. Create hook in `src/renderer/hooks/`
5. Use in component via the hook

### Adding a New Component

1. Create in appropriate `src/renderer/components/` subdirectory
2. Use TypeScript with proper prop types
3. Import from `@renderer/` path alias
4. Use Tailwind + CSS variables for styling
5. Export from the file

### Adding a Database Table

1. Create migration in `migrations/XXX_table_name.sql`
2. Create/update repository in `src/main/repositories/`
3. Add type to `src/shared/types/`
4. Update IPC handlers if needed
5. Delete database and restart to run migration

### Adding shadcn Component

```bash
pnpm dlx shadcn@latest add [component-name]
```

The component will be automatically placed in `src/renderer/components/ui/` with correct imports.

## Error Handling

### Frontend (Renderer)

```typescript
try {
  const response = await window.api.invoke('channel:name', params)
  if (response.success && response.data) {
    // Handle success
  } else {
    // Log and show error
    logger.error('Operation failed:', response.error)
    alert(response.error?.message || 'Operation failed')
  }
} catch (error) {
  logger.error('Exception:', error)
  alert('An error occurred')
}
```

### Backend (Main Process)

```typescript
import { createHandler, IpcError } from '../utils'

ipcMain.handle(
  'channel:name',
  createHandler(async (event, request) => {
    // Validation
    if (!request.param) {
      throw new IpcError('INVALID_INPUT', 'Param is required')
    }
    
    // Operation
    const result = await doSomething(request.param)
    
    // Return data (createHandler wraps in success response)
    return result
  })
)
```

## Testing Strategy

### What to Test

1. **After building main**: Run `pnpm dev:electron` to verify
2. **After UI changes**: Check both light and dark mode
3. **After database changes**: Delete DB and restart to test migrations
4. **After adding shadcn**: Import and use the component to verify

### How to Build

```bash
# Build only what changed
pnpm build:main      # If you modified main process
pnpm build:renderer  # If you modified UI
pnpm build:preload   # Rarely needed

# Or build everything
pnpm build
```

## Common Mistakes to Avoid

### 1. Using npm instead of pnpm
❌ `npm install`
✅ `pnpm install`

### 2. Hardcoding colors
❌ `className="bg-gray-800 text-white"`
✅ `className="bg-background text-foreground"`

### 3. Wrong import paths
❌ `import { cn } from "../../../lib/utils"`
✅ `import { cn } from "@renderer/lib/utils"`

### 4. Skipping migration files
❌ Modifying schema directly in code
✅ Create SQL migration in `migrations/`

### 5. Large button/text sizes
❌ `className="text-base px-4 py-3"`
✅ `className="text-xs px-3 py-2"`

### 6. Forgetting to rebuild native modules
After installing/updating better-sqlite3:
```bash
pnpm electron-rebuild -f -w better-sqlite3
```

### 7. Not using the logger
❌ `console.log('Something happened')`
✅ `logger.info('Something happened')`

### 8. Creating files without reading
Always read a file first before attempting to edit/write it.

## Project-Specific Knowledge

### Electron Window Configuration

- Title bar is hidden (`hiddenInset`)
- Traffic lights positioned at `{ x: 16, y: 16 }`
- Vibrancy effect enabled for macOS
- Window background is white (will show through CSS)

### TipTap Editor

- StarterKit includes basic markdown support
- Extensions: Link, Image, Highlight, Table, TaskList
- Content saved as HTML
- Autosave after 1000ms of inactivity

### Zustand Stores

- `uiStore` - UI state (sidebar, modals, theme, search)
- `noteStore` - Active note, note list, filters
- `notebookStore` - Notebook tree, expanded state
- `tagStore` - Tag list, selected tags

### Database

- SQLite with better-sqlite3
- FTS5 for full-text search
- Foreign keys enabled
- Timestamps are Unix epoch (seconds)

## When Stuck

1. **Check CLAUDE.md** for commands and structure
2. **Read existing similar code** for patterns
3. **Check the logs** in Electron DevTools console
4. **Rebuild main process** if IPC not working
5. **Delete database** if schema issues
6. **Ask user for clarification** if requirements unclear

## Success Checklist

Before marking a task complete:

- [ ] Code follows existing patterns
- [ ] Uses pnpm (not npm)
- [ ] Uses path aliases (@renderer/, etc.)
- [ ] Follows macOS design system
- [ ] Uses CSS variables (not hardcoded colors)
- [ ] Properly typed with TypeScript
- [ ] Includes error handling
- [ ] Tested in the app
- [ ] No console errors
- [ ] Works in both light and dark mode

## Quick Reference

### Most Common Commands
```bash
pnpm dev:electron                          # Start development
pnpm build:main                            # Rebuild main process
pnpm dlx shadcn@latest add [component]     # Add UI component
pnpm electron-rebuild -f -w better-sqlite3 # Rebuild native module
```

### Most Common Paths
```
src/renderer/components/Layout/  # Main UI components
src/renderer/components/ui/      # shadcn components
src/main/ipc/handlers/           # IPC handlers
migrations/                      # Database migrations
```

### Most Common Imports
```typescript
// Utils
import { cn } from "@renderer/lib/utils"

// Stores
import { useNoteStore } from "@renderer/stores/noteStore"
import { useUIStore } from "@renderer/stores/uiStore"

// Logger
import { logger } from "@renderer/utils/logger"

// Icons
import { Star, Pin, Archive } from "lucide-react"

// shadcn
import { Button } from "@renderer/components/ui/button"
import { Dialog } from "@renderer/components/ui/dialog"
```

---

**Remember**: This is a production-quality macOS note-taking app. Maintain high standards for code quality, design consistency, and user experience.
