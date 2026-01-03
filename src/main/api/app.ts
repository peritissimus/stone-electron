/**
 * Hono API Application
 *
 * Main Hono app with all routes configured.
 * Routes use services from the DI container.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { getContainer, Container } from './container';

// Create typed Hono app with container in context
type Env = {
  Variables: {
    container: ReturnType<typeof getContainer>;
  };
};

export function createApp() {
  const app = new Hono<Env>();

  // Middleware
  app.use('*', cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  }));
  app.use('*', logger());

  // Inject container into context
  app.use('*', async (c, next) => {
    c.set('container', getContainer());
    await next();
  });

  // Health check
  app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ==========================================================================
  // Notes Routes
  // ==========================================================================
  const notes = new Hono<Env>();

  notes.get('/', async (c) => {
    const { noteService } = c.get('container').cradle;
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;
    const favorites = c.req.query('favorites');
    const deleted = c.req.query('deleted');
    const folder = c.req.query('folder');

    let notes;
    if (favorites === 'true') {
      notes = await noteService.getFavorites();
    } else if (deleted === 'true') {
      notes = await noteService.getDeleted();
    } else if (folder) {
      notes = await noteService.findByFolder(folder);
    } else {
      notes = await noteService.findAll({ limit, offset });
    }

    return c.json({ success: true, data: notes });
  });

  notes.get('/recent', async (c) => {
    const { noteService } = c.get('container').cradle;
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 10;
    const notes = await noteService.getRecent(limit);
    return c.json({ success: true, data: notes });
  });

  notes.get('/:id', async (c) => {
    const { noteService } = c.get('container').cradle;
    const note = await noteService.findById(c.req.param('id'));
    if (!note) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Note not found' } }, 404);
    }
    return c.json({ success: true, data: note });
  });

  notes.get('/:id/content', async (c) => {
    const { noteService } = c.get('container').cradle;
    const content = await noteService.getContent(c.req.param('id'));
    if (content === null) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Note not found' } }, 404);
    }
    return c.json({ success: true, data: { content } });
  });

  notes.get('/:id/raw', async (c) => {
    const { noteService } = c.get('container').cradle;
    const content = await noteService.getRawContent(c.req.param('id'));
    if (content === null) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Note not found' } }, 404);
    }
    return c.json({ success: true, data: { content } });
  });

  notes.post('/', async (c) => {
    const { noteService } = c.get('container').cradle;
    const body = await c.req.json();
    const note = await noteService.createNote(body);
    return c.json({ success: true, data: note }, 201);
  });

  notes.put('/:id', async (c) => {
    const { noteService } = c.get('container').cradle;
    const body = await c.req.json();
    const note = await noteService.updateNote(c.req.param('id'), body);
    return c.json({ success: true, data: note });
  });

  notes.delete('/:id', async (c) => {
    const { noteService } = c.get('container').cradle;
    const permanent = c.req.query('permanent') === 'true';
    await noteService.deleteNote(c.req.param('id'), permanent);
    return c.json({ success: true });
  });

  notes.post('/:id/restore', async (c) => {
    const { noteService } = c.get('container').cradle;
    const note = await noteService.restoreNote(c.req.param('id'));
    return c.json({ success: true, data: note });
  });

  notes.post('/:id/move', async (c) => {
    const { noteService } = c.get('container').cradle;
    const body = await c.req.json();
    if (!body.folderPath) {
      return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'folderPath is required' } }, 400);
    }
    const note = await noteService.moveNote(c.req.param('id'), body.folderPath);
    return c.json({ success: true, data: note });
  });

  notes.post('/:id/favorite', async (c) => {
    const { noteService } = c.get('container').cradle;
    const note = await noteService.toggleFavorite(c.req.param('id'));
    return c.json({ success: true, data: note });
  });

  notes.post('/:id/pin', async (c) => {
    const { noteService } = c.get('container').cradle;
    const note = await noteService.togglePin(c.req.param('id'));
    return c.json({ success: true, data: note });
  });

  notes.get('/:id/backlinks', async (c) => {
    const { noteService } = c.get('container').cradle;
    const backlinks = await noteService.getBacklinks(c.req.param('id'));
    return c.json({ success: true, data: backlinks });
  });

  // ==========================================================================
  // Notebooks Routes
  // ==========================================================================
  const notebooks = new Hono<Env>();

  notebooks.get('/', async (c) => {
    const { notebookService } = c.get('container').cradle;
    const notebooks = await notebookService.getAllFlat(true);
    return c.json({ success: true, data: notebooks });
  });

  notebooks.get('/tree', async (c) => {
    const { notebookService } = c.get('container').cradle;
    const tree = await notebookService.getTree();
    return c.json({ success: true, data: tree });
  });

  notebooks.get('/:id', async (c) => {
    const { notebookRepository } = c.get('container').cradle;
    const notebook = await notebookRepository.findById(c.req.param('id'));
    if (!notebook) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Notebook not found' } }, 404);
    }
    return c.json({ success: true, data: notebook });
  });

  notebooks.post('/', async (c) => {
    const { notebookService } = c.get('container').cradle;
    const body = await c.req.json();
    const notebook = await notebookService.createNotebook(body);
    return c.json({ success: true, data: notebook }, 201);
  });

  notebooks.put('/:id', async (c) => {
    const { notebookService } = c.get('container').cradle;
    const body = await c.req.json();
    const notebook = await notebookService.updateNotebook(c.req.param('id'), body);
    return c.json({ success: true, data: notebook });
  });

  notebooks.delete('/:id', async (c) => {
    const { notebookService } = c.get('container').cradle;
    const deleteNotes = c.req.query('deleteNotes') === 'true';
    await notebookService.deleteNotebook(c.req.param('id'), deleteNotes);
    return c.json({ success: true });
  });

  // ==========================================================================
  // Tags Routes
  // ==========================================================================
  const tags = new Hono<Env>();

  tags.get('/', async (c) => {
    const { tagService } = c.get('container').cradle;
    const sort = c.req.query('sort') as 'name' | 'count' | 'recent' | undefined;
    const tags = await tagService.getAllTags(sort || 'name');
    return c.json({ success: true, data: tags });
  });

  tags.get('/:id', async (c) => {
    const { tagService } = c.get('container').cradle;
    const tag = await tagService.findById(c.req.param('id'));
    if (!tag) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tag not found' } }, 404);
    }
    return c.json({ success: true, data: tag });
  });

  tags.post('/', async (c) => {
    const { tagService } = c.get('container').cradle;
    const body = await c.req.json();
    const tag = await tagService.createTag(body);
    return c.json({ success: true, data: tag }, 201);
  });

  tags.delete('/:id', async (c) => {
    const { tagService } = c.get('container').cradle;
    const result = await tagService.deleteTag(c.req.param('id'));
    return c.json({ success: true, data: result });
  });

  // ==========================================================================
  // Workspaces Routes
  // ==========================================================================
  const workspaces = new Hono<Env>();

  workspaces.get('/', async (c) => {
    const { workspaceService } = c.get('container').cradle;
    const workspaces = await workspaceService.getAllWorkspaces();
    return c.json({ success: true, data: workspaces });
  });

  workspaces.get('/active', async (c) => {
    const { workspaceService } = c.get('container').cradle;
    const workspace = await workspaceService.getActiveWorkspace();
    if (!workspace) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'No active workspace' } }, 404);
    }
    return c.json({ success: true, data: workspace });
  });

  workspaces.get('/:id', async (c) => {
    const { workspaceRepository } = c.get('container').cradle;
    const workspace = await workspaceRepository.findById(c.req.param('id'));
    if (!workspace) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, 404);
    }
    return c.json({ success: true, data: workspace });
  });

  workspaces.post('/', async (c) => {
    const { workspaceService } = c.get('container').cradle;
    const body = await c.req.json();
    const workspace = await workspaceService.createWorkspace(body);
    return c.json({ success: true, data: workspace }, 201);
  });

  workspaces.post('/:id/activate', async (c) => {
    const { workspaceService } = c.get('container').cradle;
    const workspace = await workspaceService.setActiveWorkspace(c.req.param('id'));
    return c.json({ success: true, data: workspace });
  });

  workspaces.post('/:id/sync', async (c) => {
    const { workspaceService } = c.get('container').cradle;
    const result = await workspaceService.syncWorkspace(c.req.param('id'));
    return c.json({ success: true, data: result });
  });

  // ==========================================================================
  // Search Routes
  // ==========================================================================
  const search = new Hono<Env>();

  search.get('/', async (c) => {
    const { searchService } = c.get('container').cradle;
    const q = c.req.query('q');
    if (!q) {
      return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Query parameter "q" is required' } }, 400);
    }
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50;
    const results = await searchService.searchFullText(q, limit);
    return c.json({ success: true, data: results });
  });

  search.get('/title', async (c) => {
    const { searchService } = c.get('container').cradle;
    const q = c.req.query('q');
    if (!q) {
      return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Query parameter "q" is required' } }, 400);
    }
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;
    const results = await searchService.searchByTitle(q, limit);
    return c.json({ success: true, data: results });
  });

  // ==========================================================================
  // Mount Routes
  // ==========================================================================
  app.route('/api/notes', notes);
  app.route('/api/notebooks', notebooks);
  app.route('/api/tags', tags);
  app.route('/api/workspaces', workspaces);
  app.route('/api/search', search);

  // Error handling
  app.onError((err, c) => {
    console.error('[API] Error:', err);
    return c.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    }, 500);
  });

  // 404 handler
  app.notFound((c) => {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
    }, 404);
  });

  return app;
}
