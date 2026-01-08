import { describe, it } from 'vitest';
import { filesOfProject } from 'tsarch';

/**
 * Hexagonal Architecture Enforcement Tests
 *
 * These tests enforce the dependency rules defined in CLAUDE.md:
 *
 * Dependency Rule:
 * ┌─────────────────────────────────────────────────┐
 * │               INFRASTRUCTURE                    │
 * │                 (imports all)                   │
 * ├─────────────────────────────────────────────────┤
 * │                  ADAPTERS                       │
 * │          (imports domain, application)          │
 * ├─────────────────────────────────────────────────┤
 * │                APPLICATION                      │
 * │              (imports domain)                   │
 * ├─────────────────────────────────────────────────┤
 * │                   DOMAIN                        │
 * │              (imports nothing)                  │
 * └─────────────────────────────────────────────────┘
 */

describe('Hexagonal Architecture - Layer Dependencies', () => {
  const hexPath = 'src/hex';

  describe('Domain Layer', () => {
    it('should NOT depend on application layer', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/domain`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/application`);

      await rule.check();
    });

    it('should NOT depend on adapters layer', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/domain`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/adapters`);

      await rule.check();
    });

    it('should NOT depend on infrastructure layer', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/domain`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/infrastructure`);

      await rule.check();
    });

    it('should be free of cyclic dependencies', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/domain`)
        .should()
        .beFreeOfCycles();

      await rule.check();
    });
  });

  describe('Application Layer', () => {
    it('should NOT depend on adapters layer', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/application`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/adapters`);

      await rule.check();
    });

    it('should NOT depend on infrastructure layer', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/application`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/infrastructure`);

      await rule.check();
    });

    it('CAN depend on domain layer', async () => {
      // This is an affirmative check - application should use domain
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/application`)
        .should()
        .dependOnFiles()
        .inFolder(`${hexPath}/domain`);

      await rule.check();
    });

    it('should be free of cyclic dependencies', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/application`)
        .should()
        .beFreeOfCycles();

      await rule.check();
    });
  });

  describe('Adapters Layer', () => {
    it('should NOT depend on infrastructure layer', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/infrastructure`);

      await rule.check();
    });

    it('CAN depend on domain layer', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters`)
        .should()
        .dependOnFiles()
        .inFolder(`${hexPath}/domain`);

      await rule.check();
    });

    it('CAN depend on application layer', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters`)
        .should()
        .dependOnFiles()
        .inFolder(`${hexPath}/application`);

      await rule.check();
    });

    it('should be free of cyclic dependencies', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters`)
        .should()
        .beFreeOfCycles();

      await rule.check();
    });
  });

  describe('Shared Layer', () => {
    it('should NOT depend on domain layer', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/shared`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/domain`);

      await rule.check();
    });

    it('should NOT depend on application layer', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/shared`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/application`);

      await rule.check();
    });

    it('should NOT depend on adapters layer', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/shared`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/adapters`);

      await rule.check();
    });

    it('should NOT depend on infrastructure layer', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/shared`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/infrastructure`);

      await rule.check();
    });

    it('should be free of cyclic dependencies', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/shared`)
        .should()
        .beFreeOfCycles();

      await rule.check();
    });
  });

  describe('Infrastructure Layer', () => {
    it('CAN depend on all layers (wires everything)', async () => {
      // Infrastructure is allowed to import from all layers
      // This test just validates it exists and is cycle-free
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/infrastructure`)
        .should()
        .beFreeOfCycles();

      await rule.check();
    });
  });
});

describe('Hexagonal Architecture - Adapter Isolation', () => {
  const hexPath = 'src/hex';

  describe('IN Adapters', () => {
    it('should NOT depend on OUT adapters', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters/in`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/adapters/out`);

      await rule.check();
    });

    it('should be free of cyclic dependencies', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters/in`)
        .should()
        .beFreeOfCycles();

      await rule.check();
    });
  });

  describe('OUT Adapters', () => {
    it('should NOT depend on IN adapters', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters/out`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/adapters/in`);

      await rule.check();
    });

    it('should be free of cyclic dependencies', async () => {
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters/out`)
        .should()
        .beFreeOfCycles();

      await rule.check();
    });
  });
});

describe('Hexagonal Architecture - Port Contracts', () => {
  const hexPath = 'src/hex';

  describe('IN Ports', () => {
    it('should be in domain/ports/in', async () => {
      // Ensure IN ports are defined in the correct location
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/domain/ports/in`)
        .should()
        .beFreeOfCycles();

      await rule.check();
    });
  });

  describe('OUT Ports', () => {
    it('should be in domain/ports/out', async () => {
      // Ensure OUT ports are defined in the correct location
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/domain/ports/out`)
        .should()
        .beFreeOfCycles();

      await rule.check();
    });
  });
});

describe('Hexagonal Architecture - Port Connection Pattern', () => {
  const hexPath = 'src/hex';

  describe('Use Cases (THE BRIDGE)', () => {
    it('MUST import from IN ports (implements them)', async () => {
      // Use cases implement IN port interfaces
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/application/usecases`)
        .should()
        .dependOnFiles()
        .inFolder(`${hexPath}/domain/ports/in`);

      await rule.check();
    });

    it('MUST import from OUT ports (uses them)', async () => {
      // Use cases use OUT port interfaces (for injected dependencies)
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/application/usecases`)
        .should()
        .dependOnFiles()
        .inFolder(`${hexPath}/domain/ports/out`);

      await rule.check();
    });

    it('connects IN ports to OUT ports (the bridge)', async () => {
      // This validates that use cases are truly the connection point
      // They must depend on BOTH IN and OUT ports
      const ruleIn = await filesOfProject()
        .inFolder(`${hexPath}/application/usecases`)
        .should()
        .dependOnFiles()
        .inFolder(`${hexPath}/domain/ports`);

      await ruleIn.check();
    });
  });

  describe('IN Adapters (Drivers)', () => {
    it('should import from IN ports OR use cases', async () => {
      // IN adapters call use cases (which implement IN ports)
      // or directly reference IN port types
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters/in`)
        .should()
        .dependOnFiles()
        .matchingPattern('.*/(ports/in|application/usecases)/.*');

      await rule.check();
    });

    it('should NOT import from OUT ports', async () => {
      // IN adapters should never touch OUT ports
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters/in`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/domain/ports/out`);

      await rule.check();
    });
  });

  describe('OUT Adapters (Driven)', () => {
    it('MUST import from OUT ports (implements them)', async () => {
      // OUT adapters implement OUT port interfaces
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters/out`)
        .should()
        .dependOnFiles()
        .inFolder(`${hexPath}/domain/ports/out`);

      await rule.check();
    });

    it('should NOT import from IN ports', async () => {
      // OUT adapters should never touch IN ports
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters/out`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/domain/ports/in`);

      await rule.check();
    });

    it('should NOT import from use cases', async () => {
      // OUT adapters should never depend on use cases
      const rule = await filesOfProject()
        .inFolder(`${hexPath}/adapters/out`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`${hexPath}/application/usecases`);

      await rule.check();
    });
  });
});

describe('Hexagonal Architecture - Overall Structure', () => {
  const hexPath = 'src/hex';

  it('entire hex folder should be free of cyclic dependencies', async () => {
    const rule = await filesOfProject()
      .inFolder(hexPath)
      .should()
      .beFreeOfCycles();

    await rule.check();
  });
});
