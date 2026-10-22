import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createAppUpdater, newerRelease, trustedUpdateUrl } from '../desktop/appUpdater';

const bytes = Buffer.from('verified release installer fixture');
const hash = createHash('sha256').update(bytes).digest('hex');
const url =
  'https://github.com/linerighI/exams/releases/download/v1.4.4/Alshereqi-Exams-WebView2-1.4.4-Setup.exe';
const release = {
  tag_name: 'v1.4.4',
  prerelease: false,
  draft: false,
  body: 'Features',
  assets: [
    {
      name: 'Alshereqi-Exams-WebView2-1.4.4-Setup.exe',
      size: bytes.length,
      digest: 'sha256:' + hash,
      browser_download_url: url,
    },
  ],
};
test('update versions do not downgrade and URLs cannot point outside the configured repository', () => {
  assert.equal(newerRelease('v1.4.10', '1.4.3'), true);
  assert.equal(newerRelease('v1.4.3-preview.1', '1.4.3'), false);
  assert.equal(newerRelease('v1.3.9', '1.4.3'), false);
  assert.throws(() =>
    trustedUpdateUrl('https://github.com/elsewhere/exams/releases/download/v1/a.exe'),
  );
  assert.throws(() =>
    trustedUpdateUrl('https://github.com.evil.example/linerighI/exams/releases/download/v1/a.exe'),
  );
});
test('updates resume partial downloads, verify exact bytes before install and reject later tampering', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'app-update-'));
  let installed = false;
  const fetcher = (async (requested: any, init: any) => {
    if (String(requested).includes('/releases?')) return Response.json([release]);
    assert.equal(requested, url);
    assert.equal(init.headers.Range, 'bytes=5-');
    return new Response(bytes.subarray(5), {
      status: 206,
      headers: { 'Content-Range': `bytes 5-${bytes.length - 1}/${bytes.length}` },
    });
  }) as typeof fetch;
  const updater = createAppUpdater({
    directory,
    current: '1.4.3',
    fetcher,
    emit: () => {},
    install: async (file, digest) => {
      assert.deepEqual(readFileSync(file), bytes);
      assert.equal(digest, hash);
      installed = true;
    },
  });
  try {
    await assert.rejects(updater.install());
    assert.equal((await updater.check()).status, 'available');
    writeFileSync(join(directory, hash + '.part'), bytes.subarray(0, 5));
    const downloaded = await updater.download();
    assert.equal(downloaded.status, 'ready', JSON.stringify(downloaded));
    assert.equal(installed, false);
    await updater.install();
    assert.equal(installed, true);
    const other = createAppUpdater({
      directory,
      current: '1.4.3',
      fetcher,
      emit: () => {},
      install: async () => {
        throw Error('must not run');
      },
    });
    await other.check();
    await other.download();
    writeFileSync(join(directory, hash + '.exe'), 'modified');
    await assert.rejects(other.install(), /تغيّر/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test('wrong digests are discarded and prereleases require explicit opt-in', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'app-update-bad-'));
  const bad = {
    ...release,
    prerelease: true,
    assets: [{ ...release.assets[0], digest: 'sha256:' + '0'.repeat(64) }],
  };
  const updater = createAppUpdater({
    directory,
    current: '1.4.3',
    emit: () => {},
    install: async () => {
      throw Error('must not install');
    },
    fetcher: (async (requested: any) =>
      String(requested).includes('/releases?')
        ? Response.json([bad])
        : new Response(bytes)) as typeof fetch,
  });
  try {
    assert.equal((await updater.check()).status, 'current');
    assert.equal((await updater.check(true)).status, 'available');
    assert.equal((await updater.download()).status, 'error');
    assert.equal(existsSync(join(directory, '0'.repeat(64) + '.exe')), false);
    assert.equal(existsSync(join(directory, '0'.repeat(64) + '.part')), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('teacher can prepare the current release for older student devices without offering it as a normal upgrade', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'update-current-'));
  const updater = createAppUpdater({
    directory,
    current: '1.4.4',
    emit: () => {},
    install: async () => {},
    fetcher: (async (requested: any) =>
      String(requested).includes('/releases?')
        ? Response.json([release])
        : new Response(bytes)) as typeof fetch,
  });
  try {
    assert.equal((await updater.check()).status, 'current');
    assert.equal((await updater.check(false, true)).status, 'available');
    assert.equal((await updater.download()).status, 'ready');
    const ready = await updater.readyPackage();
    assert.equal(ready.hash, hash);
    writeFileSync(ready.file, 'changed');
    await assert.rejects(updater.readyPackage(), /تغيّر/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
