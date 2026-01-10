/**
 * Shared Utilities
 */

export { logger, logInfo, logError, logWarn, logDebug } from './logger';
export {
  handleIpcRequest,
  type HandleIpcRequestOptions,
  type IPCErrorPayload,
  type IPCResponse,
} from './ipc';
export {
  handleRequest,
  handleOperation,
  type AdapterLayer,
  type HandleRequestOptions,
  type HandleOperationOptions,
} from './operation';
