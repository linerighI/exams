const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { root, run } = require('./desktop-tools.cjs');

try {
  const version = require('../package.json').version;
  const tag = process.env.SCHOOL_RELEASE_TAG;
  if (!tag || !/^[a-zA-Z0-9._-]+$/.test(tag))
    throw Error('Set SCHOOL_RELEASE_TAG to the GitHub preview release tag.');
  const name = `Alshereqi-Exams-WebView2-${version}-Setup.exe`;
  const payload = path.join(root, 'release', name);
  if (!fs.existsSync(payload))
    throw Error('Build the full application package with npm run dist first.');
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(payload)).digest('hex');
  fs.writeFileSync(
    path.join(root, 'release', 'online-installer-download.json'),
    JSON.stringify(
      {
        version,
        url: `https://github.com/linerighI/exams/releases/download/${tag}/${name}`,
        size: fs.statSync(payload).size,
        sha256,
      },
      null,
      2,
    ) + '\n',
  );
  run(process.env.MAKENSIS || path.join(root, '.tools/nsis/Bin/makensis.exe'), [
    `/DAPP_VERSION=${version}`,
    'scripts/webview2-online-installer.nsi',
  ]);
  const onlineName = `Alshereqi-Exams-${version}-Online-Preview-Setup.exe`;
  for (const file of [name, onlineName]) {
    const hash = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(root, 'release', file)))
      .digest('hex');
    fs.writeFileSync(path.join(root, 'release', file + '.sha256'), `${hash}  ${file}\n`);
  }
  console.log(`Online installer: release/${onlineName}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
