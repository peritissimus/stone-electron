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
const path = require('node:path');

module.exports = async function afterPack(context) {
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
};
