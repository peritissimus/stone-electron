/// <reference types="cypress" />

export {};

declare global {
  namespace Cypress {
    interface Chainable {
      mockElectron(): Chainable<void>;
    }
  }

  interface Window {
    electron: any;
  }
}

Cypress.Commands.add('mockElectron', () => {
  cy.window().then((win) => {
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
  });
});
