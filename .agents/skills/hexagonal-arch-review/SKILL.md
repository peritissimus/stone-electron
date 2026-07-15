---
name: hexagonal-arch-review
description: Rigorous architectural audit of projects using Hexagonal (Ports & Adapters) architecture. Use when the user asks to "review the architecture," "check for layer violations," "audit ports and adapters," or "verify dependency direction."
allowed-tools: Bash, Read, Grep, Glob
---

# Hexagonal Architecture Reviewer

This skill guides the agent through a multi-phase audit of a software project's structural integrity, focusing on the separation of concerns and the strict dependency rule.

## Core Architectural Guardrails

- **Dependency Direction**: All dependencies must point inward: Adapters → Application → Domain.
- **Domain Purity**: The Domain layer must be pure TypeScript/JavaScript. It must NEVER import frameworks (e.g., NestJS, Express) or infrastructure (e.g., TypeORM, Prisma).
- **Application Layer**: Use cases must orchestrate domain behavior and only interact with infrastructure through abstract Ports (interfaces).

## Review Process

### Phase 1: Structural Discovery

1. Locate core directories: Look for `src/domain`, `src/application` (or `use-cases`), and `src/infrastructure` (or `adapters`).
2. Identify tech stack: Detect if the project uses NestJS, Express, or vanilla TypeScript.
3. Map the "Composition Root": Identify where dependencies are wired together (e.g., `main.ts` or a DI container).

### Phase 2: Dependency Direction Audit

Scan imports across layers and flag the following violations:

- **Infrastructure Leakage**: Flag any domain or application file importing from `infrastructure` or external SDKs.
- **Framework Entrenchment**: Flag the use of framework-specific decorators (like `@Injectable()` or ORM `@Entity()`) inside the pure Domain layer.
- **Bypassing Layers**: Flag primary adapters (e.g., Controllers) that call the database or Domain services directly without a Use Case.

### Phase 3: Port and Adapter Verification

- **Port Definitions**: Ensure Ports are defined as Interfaces or Abstract Classes in the `application` or `domain` layers.
- **Adapter Implementation**: Verify that repository implementations (Secondary Adapters) correctly implement the defined Port interfaces.
- **Data Isolation**: Ensure that database models (e.g., TypeORM entities) are mapped to Domain Entities before entering the core.

### Phase 4: TypeScript-Specific Quality Checks

- **Boundary Validation**: Confirm that inbound data is validated using Zod or Class-Validator at the Primary Adapter or Use Case boundary.
- **Result Types**: Check if the application uses `Result` or `Either` patterns for domain errors instead of throwing generic exceptions.
- **Branded Types**: Look for the use of Branded Types or Value Objects to prevent primitive obsession (e.g., `UserId` instead of `string`).

### Security Audit (AST10)

Apply the "Lethal Trifecta" check to all identified adapters:

- Identify adapters with access to **Private Data** (e.g., SSH keys, secrets).
- Check for exposure to **Untrusted Content** (e.g., external API payloads, user uploads).
- Verify **Network Egress** restrictions for these adapters.

## Example Output Format

**[Violation] Infrastructure Leakage**
- File: `src/domain/entities/user.entity.ts`
- Issue: Imports `Column` from `typeorm`.
- Fix: Define the entity as a plain class; move ORM mapping to a Schema file in the Infrastructure layer.

**[Observation] Port Implementation**
- Interface: `src/application/ports/user-repository.ts`
- Implementation: `src/infrastructure/database/postgres-user-repo.ts`
- Status: ✅ Correctly implemented.
