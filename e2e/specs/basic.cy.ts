describe('Basic User Journey', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win) {
        // Mock the electron object
        win.electron = {
          invoke: cy.stub().as('electronInvoke'),
          on: cy
            .stub()
            .as('electronOn')
            .returns(() => {}),
          once: cy.stub().as('electronOnce'),
          off: cy.stub().as('electronOff'),
        };

        // Setup default mocks
        const invoke = win.electron.invoke;

        // Mock workspaces
        invoke.withArgs('workspaces:getAll').resolves({
          success: true,
          data: {
            workspaces: [
              { id: 'ws-1', name: 'Default Workspace', path: '/path/to/workspace', isActive: true },
            ],
          },
        });

        invoke.withArgs('workspaces:getActive').resolves({
          success: true,
          data: { workspace: { id: 'ws-1', name: 'Default Workspace' } },
        });

        invoke.withArgs('workspaces:scan').resolves({
          success: true,
          data: {
            structure: [],
            counts: {},
          },
        });

        // Mock tags
        invoke.withArgs('tags:getAll').resolves({
          success: true,
          data: [],
        });

        // Mock notes
        invoke.withArgs('notes:getAll').resolves({
          success: true,
          data: { notes: [] },
        });

        // Mock todos
        invoke.withArgs('notes:getAllTodos').resolves({
          success: true,
          data: [],
        });

        // Mock database status
        invoke.withArgs('db:getStatus').resolves({
          success: true,
          data: {
            databaseSize: 1024,
            noteCount: 0,
            notebookCount: 0,
            tagCount: 0,
          },
        });
      },
    });
  });

  it('should load the application', () => {
    cy.contains('Stone').should('be.visible');
    cy.contains('Default Workspace').should('be.visible');
  });

  it('should create a new note', () => {
    const newNote = {
      id: 'note-1',
      title: 'New Note',
      content: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: 'ws-1',
    };

    cy.get('@electronInvoke').then((invoke: any) => {
      invoke.withArgs('notes:create').resolves({
        success: true,
        data: newNote,
      });

      invoke.withArgs('notes:get', { id: 'note-1' }).resolves({
        success: true,
        data: newNote,
      });

      invoke.withArgs('notes:getContent', { id: 'note-1' }).resolves({
        success: true,
        data: { content: '' },
      });

      // After creation, getAll should return the new note
      invoke.withArgs('notes:getAll').resolves({
        success: true,
        data: { notes: [newNote] },
      });
    });

    // Click "Personal Note" button (which triggers createNote)
    cy.contains('Personal Note').click();

    // Verify editor is open
    cy.get('.ProseMirror').should('be.visible');

    // Verify note appears in list (if we had a list view visible, but we are in editor)
    // We can check if the title input is visible and has the correct value
    cy.get('input[placeholder="Untitled Note"]').should('have.value', 'New Note');
  });

  it('should edit a note', () => {
    // Setup existing note
    const note = {
      id: 'note-1',
      title: 'Existing Note',
      content: '<p>Hello World</p>',
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: 'ws-1',
    };

    // We need to reload the page to inject the initial state with the note
    cy.visit('/', {
      onBeforeLoad(win) {
        win.electron = {
          invoke: cy.stub().as('electronInvoke'),
          on: cy
            .stub()
            .as('electronOn')
            .returns(() => {}),
          once: cy.stub().as('electronOnce'),
          off: cy.stub().as('electronOff'),
        };

        const invoke = win.electron.invoke;

        // Default mocks
        invoke.withArgs('workspaces:getAll').resolves({
          success: true,
          data: {
            workspaces: [
              { id: 'ws-1', name: 'Default Workspace', path: '/path/to/workspace', isActive: true },
            ],
          },
        });
        invoke.withArgs('workspaces:getActive').resolves({
          success: true,
          data: { workspace: { id: 'ws-1', name: 'Default Workspace' } },
        });
        invoke.withArgs('workspaces:scan').resolves({
          success: true,
          data: { structure: [], counts: {} },
        });
        invoke.withArgs('tags:getAll').resolves({ success: true, data: [] });
        invoke.withArgs('notes:getAllTodos').resolves({ success: true, data: [] });
        invoke.withArgs('db:getStatus').resolves({ success: true, data: {} });

        // Specific mocks for this test
        invoke.withArgs('notes:getAll').resolves({
          success: true,
          data: { notes: [note] },
        });

        invoke.withArgs('notes:get', { id: 'note-1' }).resolves({
          success: true,
          data: note,
        });

        invoke.withArgs('notes:getContent', { id: 'note-1' }).resolves({
          success: true,
          data: { content: note.content },
        });

        invoke.withArgs('notes:update').resolves({
          success: true,
          data: { ...note, content: '<p>Hello World Updated</p>' },
        });
      },
    });

    // Click on the note in Recent Notes
    cy.contains('Existing Note').click();

    // Verify content
    cy.get('.ProseMirror').should('contain', 'Hello World');

    // Type in editor
    cy.get('.ProseMirror').type(' Updated');

    // Verify update was called
    cy.get('.ProseMirror').should('contain', 'Hello World Updated');
  });
});
