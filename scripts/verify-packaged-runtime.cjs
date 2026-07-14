const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mainBundle = path.join(root, 'dist', 'main', 'index.cjs');
const packagedApp = path.join(
  root,
  'dist',
  'build',
  'mac-arm64',
  'Stone.app',
  'Contents',
  'Resources',
  'app.asar',
);

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

console.log('Packaged runtime imports verified.');
