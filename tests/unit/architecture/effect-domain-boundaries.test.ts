import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface Violation {
  file: string;
  detail: string;
  reason: string;
}

const repoRoot = path.resolve(__dirname, '../../..');
const domainRoot = path.join(repoRoot, 'src/main/domain');
const portsRoot = path.join(domainRoot, 'ports');

// ADR-0001: domain may use effect's data modules anywhere; Effect/Context are
// port vocabulary only. Everything else in the effect ecosystem is a way of
// *doing*, and domain only states and decides.
const DOMAIN_WIDE_BINDINGS = new Set(['Data', 'Schema', 'Option', 'Either']);
const PORTS_ONLY_BINDINGS = new Set(['Effect', 'Context']);

const BANNED_CONSTRUCTS: Array<[RegExp, string]> = [
  [/\bEffect\.run\w*\s*\(/, 'the Effect runtime is invoked only at edges, never in domain'],
  [/\bEffect\.gen\b/, 'domain stays synchronous; never wrap pure computation in Effect.gen'],
  [/\bLayer\.\w/, 'Layer is infrastructure wiring, banned from domain'],
  [/\bSchedule\.\w/, 'Schedule is execution policy, banned from domain'],
];

function toPosix(filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return /\.ts$/.test(entryPath) && !/\.(test|spec)\.ts$/.test(entryPath) ? [entryPath] : [];
  });
}

function effectImportClauses(source: string): Array<{ clause: string; specifier: string }> {
  return [...source.matchAll(/import\s+(type\s+)?([^'"]+?)\s+from\s*['"](effect[^'"]*)['"]/g)].map(
    (match) => ({ clause: match[2], specifier: match[3] }),
  );
}

function bindingsOf(clause: string): string[] {
  const named = clause.match(/\{([^}]*)\}/);
  if (!named) return [clause.trim()];
  return named[1]
    .split(',')
    .map((binding) => binding.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim())
    .filter(Boolean);
}

describe('domain effect allowlist (ADR-0001)', () => {
  const files = walk(domainRoot);

  it('imports only allowlisted effect modules, in the right places', () => {
    const violations: Violation[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const inPorts = path.normalize(file).startsWith(`${portsRoot}${path.sep}`);

      for (const { clause, specifier } of effectImportClauses(source)) {
        if (specifier !== 'effect') {
          violations.push({
            file: toPosix(file),
            detail: specifier,
            reason: 'domain may import only the bare `effect` package, no deep or scoped paths',
          });
          continue;
        }
        for (const binding of bindingsOf(clause)) {
          if (DOMAIN_WIDE_BINDINGS.has(binding)) continue;
          if (PORTS_ONLY_BINDINGS.has(binding)) {
            if (!inPorts) {
              violations.push({
                file: toPosix(file),
                detail: binding,
                reason: 'Effect and Context belong to port signatures only (domain/ports/)',
              });
            }
            continue;
          }
          violations.push({
            file: toPosix(file),
            detail: binding,
            reason: 'not in the domain allowlist: Data, Schema, Option, Either, Effect, Context',
          });
        }
      }

      if (/from\s*['"]@effect\//.test(source)) {
        violations.push({
          file: toPosix(file),
          detail: '@effect/*',
          reason: '@effect scoped packages are adapter territory, banned from domain',
        });
      }

      for (const [pattern, reason] of BANNED_CONSTRUCTS) {
        if (pattern.test(source)) {
          violations.push({ file: toPosix(file), detail: String(pattern), reason });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
