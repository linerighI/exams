import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { id } from './store';
export async function renderBook(
  pdf: string,
  directory: string,
  workerDirectory: string,
  python: string,
  from: number,
  to: number,
  signal: AbortSignal,
  box?: number[],
): Promise<{ count: number; pages: { page: number; image: string; text: string }[] }> {
  const input = join(directory, `${id()}.pdf`);
  writeFileSync(input, Buffer.from(pdf, 'base64'));
  const executable = join(workerDirectory, 'runtime', 'pdf-worker.exe');
  const bundled = existsSync(executable);
  try {
    return await new Promise((resolve, reject) => {
      const args = [
        ...(bundled ? [] : [join(workerDirectory, 'pdf_worker.py')]),
        input,
        'visual',
        String(from),
        String(to),
        ...(box ? [JSON.stringify(box)] : []),
      ];
      const child = spawn(bundled ? executable : python || 'python', args, {
        windowsHide: true,
        signal,
        env: { ...process.env, PYTHONUTF8: '1' },
      });
      let out = '',
        error = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (b) => {
        out += b;
        if (out.length > 60_000_000) child.kill();
      });
      child.stderr.on('data', (b) => (error = (error + b).slice(-1000)));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) return reject(Error(`تعذرت قراءة صفحات الكتاب: ${error}`));
        try {
          const result = JSON.parse(out);
          if (
            !Number.isInteger(result.count) ||
            result.count < 1 ||
            !Array.isArray(result.pages) ||
            result.pages.some((p: any) => typeof p.image !== 'string')
          )
            throw Error('old worker');
          resolve(result);
        } catch {
          reject(Error('أعد تثبيت تحديث أداة PDF'));
        }
      });
    });
  } finally {
    try {
      unlinkSync(input);
    } catch {}
  }
}
