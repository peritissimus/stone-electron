import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type RendererLayer =
  | 'api'
  | 'stores'
  | 'hooks'
  | 'components'
  | 'pages'
  | 'types'
  | 'utils'
  | 'lib'
  | 'navigation'
  | 'shared'
  | 'other';

interface Violation {
  file: string;
  importPath: string;
  reason: string;
}

const repoRoot = path.resolve(__dirname, '../../..');
const srcRoot = path.join(repoRoot, 'src');
const rendererRoot = path.join(srcRoot, 'renderer');
const sharedRoot = path.join(srcRoot, 'shared');

function toPosix(filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function isSourceFile(filePath: string): boolean {
  return /\.(ts|tsx)$/.test(filePath) && !/\.(test|spec)\.(ts|tsx)$/.test(filePath);
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return isSourceFile(entryPath) ? [entryPath] : [];
  });
}

function layerOfPath(filePath: string): RendererLayer {
  const checks: Array<[RendererLayer, string]> = [
    ['api', path.join(rendererRoot, 'api')],
    ['stores', path.join(rendererRoot, 'stores')],
    ['hooks', path.join(rendererRoot, 'hooks')],
    ['components', path.join(rendererRoot, 'components')],
    ['pages', path.join(rendererRoot, 'pages')],
    ['types', path.join(rendererRoot, 'types')],
    ['utils', path.join(rendererRoot, 'utils')],
    ['lib', path.join(rendererRoot, 'lib')],
    ['navigation', path.join(rendererRoot, 'navigation')],
    ['shared', sharedRoot],
  ];

  const normalized = path.normalize(filePath);
  for (const [layer, root] of checks) {
    if (normalized === root || normalized.startsWith(`${root}${path.sep}`)) {
      return layer;
    }
  }
  return 'other';
}

function resolveImport(sourceFile: string, importPath: string): RendererLayer | 'external' {
  if (importPath.startsWith('.')) {
    return layerOfPath(path.resolve(path.dirname(sourceFile), importPath));
  }

  const aliases: Array<[string, string]> = [
    ['@renderer', rendererRoot],
    ['@shared', sharedRoot],
    ['@', srcRoot],
  ];

  for (const [alias, target] of aliases) {
    if (importPath === alias || importPath.startsWith(`${alias}/`)) {
      return layerOfPath(path.join(target, importPath.slice(alias.length)));
    }
  }

  return 'external';
}

function collectImports(source: string): string[] {
  const staticImports = source.matchAll(
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s*)?['"]([^'"]+)['"]/g,
  );
  const dynamicImports = source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g);
  return [...staticImports, ...dynamicImports].map((match) => match[1]);
}

function violationFor(
  sourceLayer: RendererLayer,
  targetLayer: RendererLayer | 'external',
): string | null {
  if (
    (sourceLayer === 'components' || sourceLayer === 'pages') &&
    (targetLayer === 'stores' || targetLayer === 'api')
  ) {
    return 'components and pages must go through hooks, not stores or API';
  }

  if (
    sourceLayer === 'stores' &&
    (targetLayer === 'hooks' || targetLayer === 'components' || targetLayer === 'pages')
  ) {
    return 'stores must not depend on hooks, components, or pages';
  }

  if (
    sourceLayer === 'api' &&
    (targetLayer === 'stores' ||
      targetLayer === 'hooks' ||
      targetLayer === 'components' ||
      targetLayer === 'pages')
  ) {
    return 'API wrappers must stay below state, hooks, and UI';
  }

  return null;
}

describe('renderer architecture boundaries', () => {
  it('keeps renderer data flow layered', () => {
    const violations: Violation[] = [];

    for (const file of walk(rendererRoot)) {
      const sourceLayer = layerOfPath(file);
      const source = fs.readFileSync(file, 'utf8');

      for (const importPath of collectImports(source)) {
        const targetLayer = resolveImport(file, importPath);
        const reason = violationFor(sourceLayer, targetLayer);
        if (reason) {
          violations.push({ file: toPosix(file), importPath, reason });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
