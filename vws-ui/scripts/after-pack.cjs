// electron-builder afterPack hook.
// macOS on Apple Silicon refuses to run a binary without a valid code signature.
// The build isn't signed with an Apple Developer ID ("identity": null in package.json),
// and adding our resources invalidates Electron's own signature, so ad-hoc sign the
// finished bundle (free, no Apple account). Gatekeeper still asks the user to approve
// the app the first time it's opened; see the README.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • ad-hoc signing ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};
