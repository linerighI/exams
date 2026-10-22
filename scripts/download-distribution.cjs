const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

// Use the project's supported Node runtime for HTTPS instead of legacy
// Windows PowerShell TLS. Verification remains in prepare-distribution.ps1.
const assets = {
  webview2: ['https://go.microsoft.com/fwlink/?linkid=2124701', 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'],
  nsis: ['https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z', 'nsis-3.0.4.1.7z'],
};
(async () => {
  const asset = assets[process.argv[2]];
  if (!asset) throw Error('Choose webview2 or nsis.');
  const directory = path.resolve(__dirname, '..', '.tools');
  fs.mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, asset[1]), partial = destination + '.download';
  console.log('Downloading ' + asset[1]);
  try {
    const response = await fetch(asset[0], { signal: AbortSignal.timeout(180000) });
    if (!response.ok || !response.body) throw Error('Distribution download failed: ' + response.status);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial));
    fs.renameSync(partial, destination);
  } catch (error) {
    if (fs.existsSync(partial)) fs.unlinkSync(partial);
    throw error;
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
