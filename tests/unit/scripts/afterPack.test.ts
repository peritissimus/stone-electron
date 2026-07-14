import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { pruneOnnxRuntime, pruneOnnxWeb } = require('../../../scripts/afterPack.cjs') as {
  pruneOnnxRuntime: (resourcesPath: string, platform: string, arch: string) => void;
  pruneOnnxWeb: (resourcesPath: string) => void;
};

const temporaryDirectories: string[] = [];

function createRuntimeTree(): string {
  const resourcesPath = mkdtempSync(path.join(tmpdir(), 'stone-after-pack-'));
  temporaryDirectories.push(resourcesPath);
  const binaryRoot = path.join(
    resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'onnxruntime-node',
    'bin',
    'napi-v3',
  );

  for (const target of ['darwin/arm64', 'darwin/x64', 'linux/arm64', 'win32/x64']) {
    const targetDirectory = path.join(binaryRoot, target);
    mkdirSync(targetDirectory, { recursive: true });
    writeFileSync(path.join(targetDirectory, 'runtime.bin'), target);
  }

  return resourcesPath;
}

function createWebRuntimeTree(): string {
  const resourcesPath = mkdtempSync(path.join(tmpdir(), 'stone-after-pack-web-'));
  temporaryDirectories.push(resourcesPath);
  const distributionPath = path.join(
    resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'onnxruntime-web',
    'dist',
  );
  mkdirSync(distributionPath, { recursive: true });
  for (const filename of ['ort-web.node.js', 'ort-web.node.js.map', 'ort-wasm.wasm', 'ort.js']) {
    writeFileSync(path.join(distributionPath, filename), filename);
  }
  return resourcesPath;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('afterPack ONNX pruning', () => {
  it('keeps only the packaged platform and architecture', () => {
    const resourcesPath = createRuntimeTree();

    pruneOnnxRuntime(resourcesPath, 'darwin', 'arm64');

    const binaryRoot = path.join(
      resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'onnxruntime-node',
      'bin',
      'napi-v3',
    );
    expect(existsSync(path.join(binaryRoot, 'darwin/arm64/runtime.bin'))).toBe(true);
    expect(existsSync(path.join(binaryRoot, 'darwin/x64'))).toBe(false);
    expect(existsSync(path.join(binaryRoot, 'linux'))).toBe(false);
    expect(existsSync(path.join(binaryRoot, 'win32'))).toBe(false);
  });

  it('fails packaging when the requested runtime binary is missing', () => {
    const resourcesPath = createRuntimeTree();

    expect(() => pruneOnnxRuntime(resourcesPath, 'linux', 'x64')).toThrow(
      'Missing ONNX Runtime binaries for linux-x64',
    );
  });

  it('keeps the required Node entry and removes browser-only runtime assets', () => {
    const resourcesPath = createWebRuntimeTree();

    pruneOnnxWeb(resourcesPath);

    const distributionPath = path.join(
      resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'onnxruntime-web',
      'dist',
    );
    expect(existsSync(path.join(distributionPath, 'ort-web.node.js'))).toBe(true);
    expect(existsSync(path.join(distributionPath, 'ort-web.node.js.map'))).toBe(false);
    expect(existsSync(path.join(distributionPath, 'ort-wasm.wasm'))).toBe(false);
    expect(existsSync(path.join(distributionPath, 'ort.js'))).toBe(false);
  });
});
