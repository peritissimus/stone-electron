describe('Performance Tests', () => {
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

        const invoke = win.electron.invoke;

        // Generate a large number of notes to simulate a real-world scenario
        const notes = Array.from({ length: 100 }, (_, i) => ({
          id: `note-${i}`,
          title: `Note ${i}`,
          content: `<p>Content for note ${i}</p>`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          workspaceId: 'ws-1',
          filePath: `Folder/Note-${i}.md`,
        }));

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

        // Mock file tree structure
        const structure = [
          {
            name: 'Folder',
            path: 'Folder',
            type: 'folder',
            children: notes.map((n) => ({
              name: n.title,
              path: n.filePath,
              type: 'file',
            })),
          },
        ];

        invoke.withArgs('workspaces:scan').resolves({
          success: true,
          data: {
            structure,
            counts: {},
          },
        });

        invoke.withArgs('tags:getAll').resolves({ success: true, data: [] });
        invoke.withArgs('notes:getAllTodos').resolves({ success: true, data: [] });
        invoke.withArgs('db:getStatus').resolves({ success: true, data: {} });

        invoke.withArgs('notes:getAll').resolves({
          success: true,
          data: { notes },
        });

        // Mock individual note getters
        notes.forEach((note) => {
          invoke.withArgs('notes:get', { id: note.id }).resolves({
            success: true,
            data: note,
          });
          invoke.withArgs('notes:getContent', { id: note.id }).resolves({
            success: true,
            data: { content: note.content },
          });
        });
      },
    });
  });

  it('should measure note switching performance', () => {
    // Wait for initial load
    cy.contains('Note 0').should('be.visible');

    // Measure time to switch notes
    const t0 = performance.now();

    // Click on Note 1
    cy.contains('Note 1').click();

    // Wait for content to appear
    cy.get('.ProseMirror')
      .should('contain', 'Content for note 1')
      .then(() => {
        const t1 = performance.now();
        cy.log(`Note switch time: ${t1 - t0}ms`);
        // We can add an assertion here if we have a budget, e.g., expect(t1 - t0).to.be.lessThan(200);
      });
  });

  it('should measure typing performance', () => {
    cy.contains('Note 0').click();
    cy.get('.ProseMirror').should('be.visible');

    const t0 = performance.now();
    // Type 50 characters
    cy.get('.ProseMirror')
      .type('x'.repeat(50))
      .then(() => {
        const t1 = performance.now();
        cy.log(`Typing 50 chars time: ${t1 - t0}ms`);
      });
  });
});
