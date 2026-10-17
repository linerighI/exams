const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'),
  models = path.join(root, 'speech/models');
const required = [
  'sherpa-onnx-whisper-base/base-encoder.int8.onnx',
  'sherpa-onnx-whisper-base/base-decoder.int8.onnx',
  'sherpa-onnx-whisper-base/base-tokens.txt',
  'vits-piper-ar_JO-kareem-medium-int8/ar_JO-kareem-medium.onnx',
  'vits-piper-ar_JO-kareem-medium-int8/tokens.txt',
  'vits-piper-ar_JO-kareem-medium-int8/espeak-ng-data/phondata',
  'vits-piper-en_US-amy-low-int8/en_US-amy-low.onnx',
  'vits-piper-en_US-amy-low-int8/tokens.txt',
  'vits-piper-en_US-amy-low-int8/espeak-ng-data/phondata',
];
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestPath = path.join(root, 'speech/models-manifest.json');
function check() {
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {};
  for (const name of required)
    if (
      !fs.existsSync(path.join(models, name)) ||
      !manifest[name] ||
      manifest[name] !== hash(path.join(models, name))
    )
      throw Error('Offline speech files missing or changed. Run npm run speech:setup.');
}
async function setup() {
  fs.mkdirSync(models, { recursive: true });
  const cache = path.join(root, '.tools/speech');
  fs.mkdirSync(cache, { recursive: true });
  const assets = JSON.parse(
    fs.readFileSync(path.join(root, 'speech/downloads.json'), 'utf8').replace(/^\uFEFF/, ''),
  );
  for (const asset of assets) {
    if (
      !/^https:\/\/github\.com\/k2-fsa\/sherpa-onnx\/releases\/download\//.test(asset.url) ||
      !/^sha256:[a-f0-9]{64}$/.test(asset.digest)
    )
      throw Error('Invalid pinned speech asset');
    const archive = path.join(cache, path.basename(asset.name));
    if (!fs.existsSync(archive)) {
      console.log(`Downloading ${asset.name}`);
      const response = await fetch(asset.url);
      if (!response.ok || !response.body) throw Error(`Speech download failed: ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(archive));
    }
    if ('sha256:' + hash(archive) !== asset.digest || fs.statSync(archive).size !== asset.size)
      throw Error(`Speech archive checksum mismatch: ${asset.name}`);
    const list = spawnSync('tar', ['-tjf', archive], { encoding: 'utf8', windowsHide: true });
    if (list.status !== 0) throw Error('Cannot inspect speech archive');
    if (
      list.stdout
        .split(/\r?\n/)
        .some((entry) => entry && (path.isAbsolute(entry) || entry.split(/[\\/]/).includes('..')))
    )
      throw Error('Invalid speech archive path');
    const unpack = spawnSync('tar', ['-xjf', archive, '-C', models], {
      stdio: 'inherit',
      windowsHide: true,
    });
    if (unpack.status !== 0) throw Error('Cannot extract speech models');
  }
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      Object.fromEntries(required.map((name) => [name, hash(path.join(models, name))])),
      null,
      2,
    ) + '\n',
  );
  check();
  console.log('Offline Arabic/English speech models ready.');
}
if (require.main === module) {
  (process.argv.includes('--check') ? Promise.resolve().then(check) : setup()).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
module.exports = { check };
