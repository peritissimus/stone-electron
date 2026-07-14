/**
 * afterPack — ad-hoc sign the macOS bundle.
 *
 * electron-builder skips signing when `mac.identity` is null, which leaves the
 * app with the stale linker signature on the main binary and unsealed
 * resources — an *invalid* signature that Gatekeeper rejects as "Stone is
 * damaged" on any quarantined (downloaded) copy. We have no Apple Developer ID
 * and can't notarize, but a *valid ad-hoc* signature is enough to downgrade
 * that hard block to the softer "unidentified developer" prompt (right-click →
 * Open), and it lets the arm64 build run at all.
 *
 * Runs after the bundle is assembled and before the dmg/zip are built, so the
 * archived artifacts carry the valid signature.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ARCH_NAMES = {
  0: 'ia32',
  1: 'x64',
  2: 'armv7l',
  3: 'arm64',
  4: 'universal',
};

function pruneOnnxRuntime(resourcesPath, platform, arch) {
  const binaryRoot = path.join(
    resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'onnxruntime-node',
    'bin',
    'napi-v3',
  );
  const targetDirectory = path.join(binaryRoot, platform, arch);

  if (!fs.existsSync(targetDirectory)) {
    throw new Error(`Missing ONNX Runtime binaries for ${platform}-${arch}: ${targetDirectory}`);
  }

  for (const platformEntry of fs.readdirSync(binaryRoot, { withFileTypes: true })) {
    if (!platformEntry.isDirectory()) continue;

    const platformPath = path.join(binaryRoot, platformEntry.name);
    if (platformEntry.name !== platform) {
      fs.rmSync(platformPath, { recursive: true, force: true });
      continue;
    }

    for (const archEntry of fs.readdirSync(platformPath, { withFileTypes: true })) {
      if (archEntry.isDirectory() && archEntry.name !== arch) {
        fs.rmSync(path.join(platformPath, archEntry.name), { recursive: true, force: true });
      }
    }
  }
}

function pruneOnnxWeb(resourcesPath) {
  const distributionPath = path.join(
    resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'onnxruntime-web',
    'dist',
  );
  const nodeEntry = path.join(distributionPath, 'ort-web.node.js');

  if (!fs.existsSync(nodeEntry)) {
    throw new Error(`Missing ONNX Runtime Web Node entry: ${nodeEntry}`);
  }

  for (const entry of fs.readdirSync(distributionPath, { withFileTypes: true })) {
    if (entry.name !== 'ort-web.node.js') {
      fs.rmSync(path.join(distributionPath, entry.name), { recursive: true, force: true });
    }
  }
}

async function afterPack(context) {
  const arch =
    typeof context.arch === 'string' ? context.arch : ARCH_NAMES[context.arch];
  if (!arch) throw new Error(`Unsupported packaging architecture: ${context.arch}`);

  const resourcesPath =
    context.electronPlatformName === 'darwin'
      ? path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          'Contents',
          'Resources',
        )
      : path.join(context.appOutDir, 'resources');

  pruneOnnxRuntime(resourcesPath, context.electronPlatformName, arch);
  pruneOnnxWeb(resourcesPath);
  console.log(`  • pruned ONNX Runtime binaries  target=${context.electronPlatformName}-${arch}`);

  if (context.electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  console.log(`  • ad-hoc signing ${appName}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  });
  // Fail the build if the signature didn't take — a broken signature is the
  // exact failure mode this hook exists to prevent.
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], {
    stdio: 'inherit',
  });
}

module.exports = afterPack;
module.exports.pruneOnnxRuntime = pruneOnnxRuntime;
module.exports.pruneOnnxWeb = pruneOnnxWeb;
