/**
 * Dependency Injection
 */

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
} from './container';
