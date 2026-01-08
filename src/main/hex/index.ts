/**
 * Hexagonal Architecture Module
 *
 * This module contains the clean architecture implementation:
 * - domain/     : Entities, Ports, Use Cases (business logic)
 * - adapters/   : In/Out adapters (IPC, persistence, services)
 * - infrastructure/ : DI container and app wiring
 */

// Domain exports
export * from './domain';

// Infrastructure exports
export {
  createContainer,
  initializeContainer,
  getContainer,
  resetContainer,
  registerIPCHandlers,
  unregisterIPCHandlers,
  setActiveWorkspacePath,
  getActiveWorkspacePath,
  type Container,
  type ContainerDeps,
} from './infrastructure';
