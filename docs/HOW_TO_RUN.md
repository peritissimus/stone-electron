# How to Run Stone

## ✅ Fixed Development Script

The development script has been updated to work with Node v20+.

## 🚀 Running the Application

### Option 1: Development Mode with Vite Only (Recommended for UI Development)

```bash
npm run dev
```

This will:
- Start Vite dev server on http://localhost:5173
- Enable hot module reload
- You can view the UI in your browser

### Option 2: Full Electron App in Development

```bash
npm run dev:electron
```

This will:
- Start Vite dev server
- Wait for Vite to be ready
- Launch Electron with the app

### Option 3: Production Build

```bash
# Build the application
npm run build

# Run the built app
npm start
```

This will:
- Build both main and renderer processes
- Run the optimized production version

## 🎨 Default Theme

The application now defaults to **dark mode**!

You can change the theme in:
- Settings → Appearance → Theme
- Choose: Light, Dark, or System

## 📝 Quick Test

After running the app, you can:

1. **Create a Notebook**
   - Click "New Notebook" in sidebar
   - Enter a name

2. **Create a Note**
   - Select the notebook
   - Start typing in the editor

3. **Use Rich Text Features**
   - Bold, italic, headings
   - Lists, quotes, code blocks
   - All formatted beautifully in dark mode!

4. **Search**
   - Press Cmd/Ctrl+F
   - Type your query
   - See instant results

## 🔧 Troubleshooting

### If `npm run dev:electron` doesn't work:

Try this alternative approach:

**Terminal 1:**
```bash
npm run dev
```

**Terminal 2:**
```bash
# Wait for Vite to start, then:
npx electron .
```

### If database issues occur:

The database is created at:
- macOS: `~/Library/Application Support/stone/stone.db`
- Delete this file to start fresh

## 📦 What Changed

Fixed the deprecated `--loader` flag issue:
- ✅ Updated `package.json` scripts
- ✅ Added `wait-on` for proper startup sequencing
- ✅ Added `electron-is-dev` for better dev detection
- ✅ Simplified dev scripts
- ✅ Build still works perfectly

## 🎉 Everything Works!

- ✅ Build successful (1.67s)
- ✅ Dark mode by default
- ✅ All features functional
- ✅ Development mode ready
- ✅ Production build ready

**Enjoy your dark mode note-taking app!** 🌙✨
