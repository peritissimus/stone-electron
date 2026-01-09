/**
 * Domain Layer Index
 *
 * Pure business logic with ZERO external dependencies.
 *
 * Structure:
 * - entities/       : Domain entities with business rules
 * - value-objects/  : Immutable value objects
 * - services/       : Pure domain services (no I/O)
 * - errors/         : Domain-specific errors
 * - ports/          : Port interfaces (in/out)
 *
 * Note: Use cases are in the application/ layer, not here.
 */

// Entities
export * from './entities';

// Value Objects
export * from './value-objects';

// Domain Services (pure logic)
export * from './services';

// Errors
export * from './errors';

// Ports (interfaces only)
export * from './ports';
