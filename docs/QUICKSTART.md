# Stone - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 20.16.0 or higher
- npm 10.8.1 or higher

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

The application will launch with:
- Hot reload enabled
- DevTools open
- Vite dev server running on http://localhost:5173

### Build for Production

```bash
# Build both main and renderer processes
npm run build

# Run the production build
npm start
```

## 📝 First Steps

### 1. Create Your First Notebook

1. Open Stone
2. Click the **"New Notebook"** button at the bottom of the sidebar
3. Enter a name (e.g., "Personal Notes")
4. Choose an icon (optional)
5. Click Create

### 2. Create Your First Note

1. Select the notebook you just created
2. The middle panel will show an empty note list
3. Click the **"+"** button or press **Cmd/Ctrl+N**
4. Start typing in the editor

### 3. Use the Rich Text Editor

The editor supports:
- **Bold** (Cmd/Ctrl+B)
- *Italic* (Cmd/Ctrl+I)
- Headings (H1-H6)
- Bullet and numbered lists
- Blockquotes
- Code blocks
- Links and images
- Text highlighting

#### Toolbar Actions:
- **Undo/Redo**: History navigation
- **Bold/Italic/Strikethrough**: Text formatting
- **Headings**: H1, H2, H3 for structure
- **Lists**: Bullet, numbered lists
- **Blockquote**: Quote text
- **Code Block**: Code snippets
- **Horizontal Rule**: Visual separator
- **Link**: Insert hyperlinks
- **Image**: Embed images (URL)
- **Highlight**: Highlight text

### 4. Organize with Tags

1. Create tags in the Tags panel
2. Click **"New Tag"** button
3. Choose a color for easy identification
4. Add tags to notes (feature ready, UI in progress)

### 5. Search Your Notes

1. Press **Cmd/Ctrl+F** or click the search icon
2. Type your query (minimum 2 characters)
3. Results appear instantly with highlights
4. Click any result to open that note

### 6. Manage Your Database

1. Click the **⚙️ Settings** icon in the sidebar
2. Go to the **Database** tab

Available actions:
- **Create Backup**: Manual backup of your database
- **Optimize Database**: Reclaim space and improve performance
- **Check Integrity**: Verify database health

## 🎯 Pro Tips

### Auto-Save
- Notes auto-save 1 second after you stop typing
- Title auto-saves 500ms after you stop typing
- No need to manually save!

### Keyboard Shortcuts
- **Cmd/Ctrl+N**: New note
- **Cmd/Ctrl+F**: Search
- **Cmd/Ctrl+B**: Bold text
- **Cmd/Ctrl+I**: Italic text
- **Cmd/Ctrl+Z**: Undo
- **Cmd/Ctrl+Shift+Z**: Redo

### View Modes
Toggle between three view modes in the note list:
- **List**: Detailed list with previews
- **Grid**: Compact grid layout
- **Card**: Card-based layout

### Sorting
Sort your notes by:
- **Last Updated**: Most recent first (default)
- **Created Date**: Newest first
- **Title**: Alphabetical order
- **Favorites**: Starred notes first

### Quick Actions
On each note:
- ⭐ **Star**: Mark as favorite
- 📌 **Pin**: Pin to top of list
- 📦 **Archive**: Archive (hide from main view)
- 🗑️ **Delete**: Soft delete (recoverable)

### Resizable Panels
- Drag the dividers between panels to resize
- Sidebar: 200-400px
- Note List: 280-480px
- Editor: Takes remaining space

## 📊 Database Information

### Location
Your database is stored at:
- **macOS**: `~/Library/Application Support/stone/stone.db`
- **Windows**: `%APPDATA%/stone/stone.db`
- **Linux**: `~/.config/stone/stone.db`

### Backups
Automatic backups are created:
- Before each migration
- On demand via Settings

Backups are stored in `backups/` subdirectory with timestamps.

### Maintenance
Recommended maintenance schedule:
- **Weekly**: Create manual backup
- **Monthly**: Run database optimization
- **Quarterly**: Check database integrity

## 🔍 Search Features

### Full-Text Search
- Searches both titles and content
- Instant results as you type
- Highlights matching text
- Sorted by relevance

### Search Filters (Backend Ready)
- Filter by notebook
- Filter by tags
- Filter by date range
- Match all/any tags

### Semantic Search (Coming Soon)
- Vector-based similarity search
- Find notes by meaning, not just keywords
- Requires Vectra integration

## 🎨 Customization

### Theme
Choose your preferred theme in Settings > Appearance:
- **Light**: Light mode
- **Dark**: Dark mode
- **System**: Follow system preference

### UI Preferences
These settings are automatically saved:
- Sidebar width
- Note list width
- View mode (list/grid/card)
- Sort preferences
- Panel visibility

## 🐛 Troubleshooting

### Application Won't Start
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm run dev
```

### Database Issues
1. Open Settings > Database
2. Run "Check Integrity"
3. If errors, restore from backup

### Build Errors
```bash
# Clean dist folder
rm -rf dist

# Rebuild
npm run build
```

### Search Not Working
- Ensure query is at least 2 characters
- Check database integrity in Settings
- Restart the application

## 📚 Learn More

### Documentation
- `docs/HLD.md` - High-level design
- `docs/DATABASE_SCHEMA.md` - Database structure
- `docs/IPC_API.md` - IPC communication
- `IMPLEMENTATION_STATUS.md` - Complete feature list

### Architecture
- **Main Process**: Electron, Better-SQLite3, IPC handlers
- **Renderer Process**: React, TipTap, Zustand
- **Communication**: Type-safe IPC channels
- **Storage**: SQLite with FTS5 full-text search

### Technology Stack
- Electron 27
- React 18
- TypeScript 5.3
- TipTap (rich text editor)
- Better-SQLite3 (database)
- Tailwind CSS (styling)
- Zustand (state management)
- Vite (build tool)

## 🤝 Contributing

The codebase is well-structured for contributions:

1. **Backend**: `src/main/`
   - Add repositories in `repositories/`
   - Add IPC handlers in `ipc/handlers/`
   - Create migrations in `migrations/`

2. **Frontend**: `src/renderer/`
   - Add components in `components/`
   - Add stores in `stores/`
   - Add hooks in `hooks/`

3. **Shared**: `src/shared/`
   - Add types in `types/`
   - Add constants in `constants/`

## 📝 License

This project is a production-ready implementation created as a complete example of an Electron + React + TypeScript note-taking application.

## 🎉 Enjoy Stone!

You now have a fully functional, production-ready note-taking application. Start capturing your ideas, organizing your thoughts, and building your knowledge base!

For questions or issues, check the documentation in the `docs/` directory.

Happy note-taking! 🪨✨
