# Stone - Complete Documentation Index

Welcome to the Stone note-taking application documentation. This directory contains comprehensive documentation for understanding and implementing the complete system.

## 📚 Documentation Files

### 1. **HLD.md** - High-Level Design Document
Complete architectural overview with Mermaid diagrams covering:
- System architecture layers (Presentation, Renderer, Main, Data)
- Database architecture and schema diagrams
- Entity-relationship model
- Migration system lifecycle
- Repository pattern architecture
- Search system architecture
- IPC communication flows
- Data flow sequences
- Backup and restore flow
- Component hierarchy
- State management architecture
- Error handling and recovery
- Performance optimization strategy
- Security considerations
- Development workflow
- 16-phase implementation timeline

**Key Sections:**
- 14 detailed architecture diagrams using Mermaid
- Complete data flow sequences
- Migration system flow
- Backup/restore operations
- Performance optimization strategies

---

### 2. **DATABASE_SCHEMA.md** - Complete Database Schema Reference
Detailed specification of all database tables, indexes, and relationships:

**Core Tables:**
- `schema_migrations` - Migration tracking and versioning
- `notebooks` - Hierarchical organization structure
- `notes` - Main note storage with metadata
- `tags` - User-defined categorization
- `note_tags` - Many-to-many note-tag relationships
- `note_links` - Wiki-style linking and backlinks
- `attachments` - File attachment metadata
- `note_versions` - Version history snapshots
- `settings` - Key-value configuration store

**Advanced Features:**
- FTS5 virtual table for full-text search with triggers
- Performance indexes for optimized queries
- Vector database schema for semantic search
- Data types and conventions
- Constraints and referential integrity
- Performance characteristics (read/write/storage)
- Maintenance operations (VACUUM, integrity checks)
- Backup and recovery structure

---

### 3. **IPC_API.md** - Complete IPC API Reference
Comprehensive API documentation for inter-process communication:

**Channel Categories:**

1. **Note Operations (notes:\*)** - 10 channels
   - Create, update, delete, retrieve notes
   - Favorite, pin, archive operations
   - Version history management
   - Backlink retrieval

2. **Notebook Operations (notebooks:\*)** - 5 channels
   - Create, update, delete notebooks
   - Hierarchical operations
   - Note movement between notebooks

3. **Tag Operations (tags:\*)** - 5 channels
   - Tag CRUD operations
   - Tag-note associations

4. **Search Operations (search:\*)** - 5 channels
   - Full-text search (FTS5)
   - Semantic search (Vector DB)
   - Hybrid search combining both
   - Tag and date range filtering

5. **Attachment Operations (attachments:\*)** - 3 channels
   - File attachment management
   - Metadata tracking

6. **Database Management (db:\*)** - 8 channels
   - Status and statistics
   - Migration execution
   - Backup creation and restoration
   - Data import/export
   - Database optimization
   - Integrity checking

7. **Settings Operations (settings:\*)** - 3 channels
   - Key-value configuration storage

**Features:**
- Request/Response schemas for all channels
- Event broadcasting patterns
- Error handling standards
- Real-time progress reporting

---

### 4. **IMPLEMENTATION_GUIDE.md** - Step-by-Step Implementation Guide
Practical guide for implementing the Stone application:

**Sections:**

1. **Project Setup**
   - Complete npm dependencies list
   - TypeScript configuration
   - Build tool setup

2. **Directory Structure**
   - Complete file organization
   - Module separation
   - Convention patterns

3. **Database Setup**
   - DatabaseManager initialization
   - Connection lifecycle
   - Transaction support

4. **Migration System**
   - Migration file structure
   - MigrationRunner implementation
   - Rollback strategy

5. **Repository Pattern**
   - BaseRepository abstract class
   - Concrete implementations
   - Query building

6. **IPC Handler Setup**
   - Handler registration
   - Example implementations
   - Error handling patterns

7. **React Component Structure**
   - MainLayout component
   - Zustand store patterns
   - Component composition

8. **Development Workflow**
   - Development server setup
   - Hot Module Replacement (HMR)
   - Database seeding
   - Debugging techniques

9. **Testing Strategy**
   - Unit testing examples
   - Integration testing
   - Test database setup

10. **Deployment**
    - Production build process
    - Electron Builder configuration
    - Platform-specific outputs

11. **Rollback Strategy**
    - Migration rollback procedures
    - Data recovery

---

## 🏗️ Architecture Overview

```
Stone Application Stack
├── Renderer Process (React 18 + Zustand)
│   ├── Rich Text Editor (TipTap)
│   ├── UI Components (Shadcn/ui + Tailwind CSS)
│   └── State Management (Zustand stores)
├── Main Process (Node.js + Electron)
│   ├── Database Manager
│   ├── Repository Layer
│   ├── IPC Handlers
│   └── Services (Search, Embeddings)
└── Data Layer
    ├── Better-SQLite3 (Primary DB)
    ├── Vectra (Vector DB)
    └── File System (Attachments)
```

---

## 📊 Key Features Documented

### Database Management
- ✅ Complete schema with 9 core tables
- ✅ Full-text search (SQLite FTS5)
- ✅ Vector embeddings for semantic search
- ✅ Automatic versioning with snapshots
- ✅ Soft delete with recovery window
- ✅ Hierarchical notebook organization
- ✅ Wiki-style linking and backlinks
- ✅ File attachment support

### Migration System
- ✅ Automated migration detection
- ✅ Atomic transaction-based execution
- ✅ Automatic pre-migration backups
- ✅ Checksum integrity verification
- ✅ Rollback capability
- ✅ Progress reporting to UI
- ✅ Error recovery and logging

### Search Capabilities
- ✅ Full-text search with ranking
- ✅ Semantic search with embeddings
- ✅ Hybrid search combining both
- ✅ Tag-based filtering
- ✅ Date range queries
- ✅ Notebook-scoped searches
- ✅ Result highlighting

### Data Operations
- ✅ CRUD operations for all entities
- ✅ Batch operations for performance
- ✅ Transaction support
- ✅ Conflict resolution
- ✅ Auto-save with debouncing
- ✅ Version history and restoration

### Backup & Recovery
- ✅ Automatic pre-migration backups
- ✅ Manual on-demand backups
- ✅ Retention policies (keep 5 recent)
- ✅ Restore with integrity verification
- ✅ Incremental vector DB backups

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- Database manager with migration system
- Repository pattern implementations
- Basic CRUD operations

### Phase 2: Editor & Storage (Weeks 3-4)
- Rich text editor integration
- Auto-save system
- Version history

### Phase 3: Search & Discovery (Weeks 5-6)
- Full-text search implementation
- Vector embeddings
- Hybrid search

### Phase 4: UI & UX (Weeks 7-8)
- Main layout and components
- Settings panel
- Database management UI

### Phase 5: Advanced Features (Weeks 9-10)
- Export/import system
- Backup/restore UI
- Settings persistence

### Phase 6: Polish & Testing (Weeks 11-12)
- Error handling
- Performance optimization
- Packaging and distribution

---

## 🔧 Technology Stack

### Electron & Build
- **Electron** (latest stable) - Desktop framework
- **Vite** - Fast build tool with HMR
- **Electron Builder** - Distribution packaging

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS v3** - Utility styling
- **Shadcn/ui** - Component library
- **Zustand** - State management
- **React Query** - Data fetching

### Editor
- **TipTap** - Rich text editor
- **Markdown-it** - Markdown parsing
- **Prism.js** - Syntax highlighting

### Database
- **Better-SQLite3** - SQL database
- **Vectra** - Vector DB for embeddings
- **Xenova Transformers** - Embedding generation

### Utilities
- **nanoid** - ID generation
- **zod** - Schema validation
- **date-fns** - Date formatting
- **electron-store** - Settings persistence

---

## 📖 How to Use This Documentation

1. **Start with HLD.md** for architectural overview
2. **Reference DATABASE_SCHEMA.md** when working with data
3. **Check IPC_API.md** for communication patterns
4. **Follow IMPLEMENTATION_GUIDE.md** during development

---

## 📋 Documentation Status

| Document | Status | Purpose |
|----------|--------|---------|
| HLD.md | ✅ Complete | Architecture design with 14 Mermaid diagrams |
| DATABASE_SCHEMA.md | ✅ Complete | Full schema reference with constraints |
| IPC_API.md | ✅ Complete | API reference for all IPC channels |
| IMPLEMENTATION_GUIDE.md | ✅ Complete | Step-by-step implementation guide |

---

## 🎯 Next Steps

Once documentation is finalized:

1. **Approve Architecture** - Review all diagrams and flows
2. **Begin Implementation** - Start with database layer
3. **Build IPC Handlers** - Implement communication layer
4. **Develop UI** - Create React components
5. **Integration Testing** - Test complete workflows
6. **Polish & Deploy** - Final optimization and packaging

---

## 📞 Questions & Clarifications

Before starting implementation, verify:
- Database location (app.getPath('userData'))
- Attachment storage strategy
- Backup retention policy
- Vector DB embedding dimension (384)
- Search result ranking algorithm
- Auto-save debounce timing (2 seconds)
- Soft delete recovery window (30 days default)

---

**Documentation Version:** 1.0
**Created:** 2025-10-29
**Status:** Complete - Ready for Implementation Phase

---

## Quick Reference Commands

```bash
# Development
npm run dev                 # Start development mode
npm run build             # Build for production
npm run package           # Create distributable packages

# Database
npm run migration:create  # Create new migration file
npm run migration:status  # Show pending migrations
npm run migration:up      # Apply next migration

# Testing
npm test                  # Run test suite
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

---

*Last Updated: 2025-10-29*
*For questions or updates, refer to the individual documentation files.*
