const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');

(async () => {
  const root = path.resolve('.data');
  const directory = fs.mkdtempSync(path.join(root, 'parallel-download-test-'));
  const helper = path.join(directory, 'ParallelInstallerDownload.dll');
  const framework = path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework', 'v4.0.30319');
  execFileSync(
    path.join(framework, 'csc.exe'),
    [
      '/nologo',
      '/target:library',
      '/platform:anycpu',
      `/reference:${path.join(framework, 'System.Net.Http.dll')}`,
      `/out:${helper}`,
      path.resolve('scripts/ParallelInstallerDownload.cs'),
    ],
    { windowsHide: true },
  );
  const chunk = 512 * 1024;
  const data = Buffer.alloc(chunk * 10 + 37);
  for (let i = 0; i < data.length; i++) data[i] = i % 251;
  const cache = path.join(directory, 'parts');
  fs.mkdirSync(cache);
  fs.writeFileSync(path.join(cache, '00000.part'), data.subarray(0, chunk));
  fs.writeFileSync(path.join(cache, '00001.part'), data.subarray(chunk, chunk + 1000));
  let active = 0,
    peak = 0,
    dropped = false;
  const requests = [];
  const server = http.createServer((request, response) => {
    const match = /bytes=(\d+)-(\d+)/.exec(request.headers.range || '');
    if (!match) {
      response.writeHead(400).end();
      return;
    }
    const start = Number(match[1]),
      end = Number(match[2]);
    requests.push(start);
    active++;
    peak = Math.max(peak, active);
    response.once('close', () => active--);
    response.writeHead(206, {
      'Content-Range': `bytes ${request.url === '/bad' ? start + 1 : start}-${end}/${data.length}`,
      'Content-Length': end - start + 1,
    });
    const bytes = data.subarray(start, end + 1);
    if (start === chunk * 2 && !dropped && request.url !== '/bad') {
      dropped = true;
      response.write(bytes.subarray(0, 100000));
      setTimeout(() => response.destroy(), 40);
    } else {
      setTimeout(() => response.end(bytes), 80);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const runner = path.join(directory, 'run.ps1');
  fs.writeFileSync(
    runner,
    `param($Helper, $Url, $Cache, $Destination, [long]$Size)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
Add-Type -Path $Helper
$download = New-Object SchoolInstaller.ParallelDownload
$download.DownloadAsync($Url, $Cache, $Destination, $Size, 524288, 4).GetAwaiter().GetResult()
`,
  );
  const run = (url, partDirectory, output, x86 = false) =>
    new Promise((resolve) => {
      const child = spawn(
        x86
          ? path.join(process.env.WINDIR, 'SysWOW64', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
          : 'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          runner,
          '-Helper',
          helper,
          '-Url',
          url,
          '-Cache',
          partDirectory,
          '-Destination',
          output,
          '-Size',
          String(data.length),
        ],
        { windowsHide: true, cwd: directory },
      );
      let log = '';
      child.stdout.on('data', (text) => (log += text));
      child.stderr.on('data', (text) => (log += text));
      child.on('exit', (code) => resolve({ code, log }));
    });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const output = path.join(directory, 'result.exe');
    const result = await run(base + '/file', cache, output);
    assert.equal(result.code, 0, result.log);
    assert.deepEqual(fs.readFileSync(output), data);
    assert.ok(peak > 1 && peak <= 4, `Parallel request count: ${peak}`);
    assert.ok(!requests.includes(0), 'Complete cached chunks should be reused');
    assert.ok(requests.includes(chunk + 1000), 'Partial chunks should resume from saved offset');
    assert.ok(
      requests.some((start) => start > chunk * 2 && start < chunk * 3),
      'Interrupted transfer should resume',
    );
    const x86Output = path.join(directory, 'x86-result.exe');
    const x86 = await run(base + '/file', path.join(directory, 'x86-parts'), x86Output, true);
    assert.equal(x86.code, 0, x86.log);
    assert.deepEqual(fs.readFileSync(x86Output), data);
    const invalid = await run(
      base + '/bad',
      path.join(directory, 'invalid-parts'),
      path.join(directory, 'invalid.exe'),
    );
    assert.notEqual(invalid.code, 0);
    assert.equal(fs.existsSync(path.join(directory, 'invalid.exe')), false);
    console.log(
      'Precompiled downloader passed in 32-bit and 64-bit PowerShell from a temporary folder: parallel requests, cached resume, network retry, exact bytes, and invalid-range rejection.',
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(root + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
