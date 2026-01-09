/**
 * Adapters Layer Index
 *
 * Adapters connect the application to the outside world:
 * - In (Primary/Driving): IPC handlers, HTTP controllers
 * - Out (Secondary/Driven): Repositories, file storage, external services
 */

// In (Primary) Adapters
export * from './in';

// Out (Secondary) Adapters
export * from './out';
