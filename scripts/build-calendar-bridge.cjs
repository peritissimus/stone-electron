const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

if (process.platform !== 'darwin') {
  console.log('  • skipped EventKit bridge (macOS only)');
  process.exit(0);
}

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'native', 'calendar', 'StoneCalendarBridge.swift');
const infoPlist = path.join(projectRoot, 'native', 'calendar', 'Info.plist');
const entitlements = path.join(projectRoot, 'build', 'entitlements.mac.plist');
const outputDirectory = path.join(projectRoot, 'dist', 'native');
const output = path.join(outputDirectory, 'StoneCalendarBridge');
const architecture = process.arch === 'arm64' ? 'arm64' : 'x86_64';

fs.mkdirSync(outputDirectory, { recursive: true });
execFileSync(
  'xcrun',
  [
    'swiftc',
    source,
    '-parse-as-library',
    '-O',
    '-framework',
    'EventKit',
    '-target',
    `${architecture}-apple-macosx12.0`,
    '-Xlinker',
    '-sectcreate',
    '-Xlinker',
    '__TEXT',
    '-Xlinker',
    '__info_plist',
    '-Xlinker',
    infoPlist,
    '-o',
    output,
  ],
  { stdio: 'inherit' },
);
execFileSync(
  'codesign',
  [
    '--force',
    '--sign',
    '-',
    '--identifier',
    'com.stone.app',
    '--entitlements',
    entitlements,
    output,
  ],
  { stdio: 'inherit' },
);
fs.chmodSync(output, 0o755);
console.log(`  • built EventKit bridge  arch=${architecture}`);
