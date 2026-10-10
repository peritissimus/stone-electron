const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mainBundle = path.join(root, 'dist', 'main', 'index.cjs');
const appBundle =
  process.env.STONE_PACKAGED_APP ?? path.join(root, 'dist', 'build', 'mac-arm64', 'Stone.app');
const packagedApp = path.join(appBundle, 'Contents', 'Resources', 'app.asar');

for (const requiredPath of [mainBundle, packagedApp]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Packaged runtime verification is missing ${requiredPath}`);
  }
}

const source = fs.readFileSync(mainBundle, 'utf8');
const eagerDevOnlyImports = source.match(/require\(["']@opentelemetry\//g) ?? [];

if (eagerDevOnlyImports.length > 0) {
  throw new Error(
    'Production main entrypoint eagerly requires dev-only OpenTelemetry packages. ' +
      'Bundle @opentelemetry/api and keep SDK imports in the dev-only telemetry chunk.',
  );
}

// Resolve only from the shipped dependency tree, never the development install.
// This catches pruning/layout changes and incompatible native bindings before release.
const unpackedRoot = path.join(appBundle, 'Contents', 'Resources', 'app.asar.unpacked');
const plist = path.join(appBundle, 'Contents', 'Info.plist');
const minimumMacOS = execFileSync(
  '/usr/libexec/PlistBuddy',
  ['-c', 'Print :LSMinimumSystemVersion', plist],
  { encoding: 'utf8' },
).trim();
const executable = execFileSync(
  '/usr/libexec/PlistBuddy',
  ['-c', 'Print :CFBundleExecutable', plist],
  { encoding: 'utf8' },
).trim();
const nativeDirectory = path.join(
  unpackedRoot,
  'node_modules',
  'onnxruntime-node',
  'bin',
  'napi-v6',
  'darwin',
  process.arch,
);
const nativeFiles = [
  path.join(appBundle, 'Contents', 'MacOS', executable),
  path.join(appBundle, 'Contents', 'Resources', 'calendar', 'StoneCalendarBridge'),
  ...['whisper-cli', 'whisper-server'].map((name) =>
    path.join(appBundle, 'Contents', 'Resources', 'whisper', name),
  ),
  ...fs
    .readdirSync(nativeDirectory)
    .filter((name) => /\.(node|dylib)$/.test(name))
    .map((name) => path.join(nativeDirectory, name)),
];
function newerThan(version, supported) {
  const left = version.split('.').map(Number);
  const right = supported.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    if ((left[index] ?? 0) !== (right[index] ?? 0)) return (left[index] ?? 0) > (right[index] ?? 0);
  }
  return false;
}
for (const binary of nativeFiles) {
  const loadCommands = execFileSync('xcrun', ['vtool', '-show-build', binary], {
    encoding: 'utf8',
  });
  const versions = [...loadCommands.matchAll(/\bminos\s+([\d.]+)/g)].map((match) => match[1]);
  if (!versions.length || versions.some((version) => newerThan(version, minimumMacOS))) {
    throw new Error(
      `Native binary ${binary} does not support the advertised macOS ${minimumMacOS} minimum (${versions.join(', ') || 'unknown target'})`,
    );
  }
}
execFileSync(
  process.execPath,
  [
    '-e',
    `
  const { createRequire } = require('node:module');
  const { pathToFileURL } = require('node:url');
  const path = require('node:path');
  const fs = require('node:fs');
  const requirePackaged = createRequire(path.join(process.argv[1], 'package.json'));
  const root = fs.realpathSync(process.argv[1]) + path.sep;
  function resolvePackaged(name) {
    const entry = fs.realpathSync(requirePackaged.resolve(name));
    if (!entry.startsWith(root)) throw new Error('Missing shipped dependency: ' + name);
    return entry;
  }
  async function verify() {
    const ort = requirePackaged(resolvePackaged('onnxruntime-node'));
    if (typeof ort.InferenceSession.create !== 'function') throw new Error('Native ONNX runtime unavailable');
    const sharp = requirePackaged(resolvePackaged('sharp'));
    await sharp({ create: { width: 1, height: 1, channels: 3, background: 'white' } }).png().toBuffer();
    const transformers = await import(pathToFileURL(resolvePackaged('@huggingface/transformers')).href);
    if (typeof transformers.pipeline !== 'function') throw new Error('Transformers runtime unavailable');
    const { createClient } = requirePackaged(resolvePackaged('@libsql/client'));
    const db = createClient({ url: ':memory:' });
    await db.execute('SELECT 1');
    db.close();
  }
  verify().catch(error => { console.error(error); process.exitCode = 1; });
`,
    unpackedRoot,
  ],
  { stdio: 'inherit', cwd: unpackedRoot, env: { ...process.env, ORT_DISABLE_TELEMETRY: '1' } },
);

console.log('Packaged ML, image and database runtimes verified.');
