const fs = require('node:fs');
module.exports = async () => {
  for (const path of [
    'worker/runtime/pdf-worker.exe',
    'worker/runtime/models/det/inference.pdmodel',
    'worker/runtime/models/ar/inference.pdmodel',
    'worker/runtime/models/cls/inference.pdmodel',
  ])
    if (!fs.existsSync(path))
      throw Error(
        'Missing offline PDF worker: ' + path + '. Run npm run worker:build before packaging.',
      );
};
