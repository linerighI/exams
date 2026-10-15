import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { id } from './store';
export function extractPDF(
  data: string,
  directory: string,
  pythonPath: string,
  workerDirectory: string,
  signal: AbortSignal,
): Promise<any> {
  const input = join(directory, `${id()}.pdf`);
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > 30 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== '%PDF-')
    throw new Error('ارفع PDF صالحًا بحجم أقل من 30 ميجابايت');
  writeFileSync(input, bytes);
  const bundled = join(workerDirectory, 'runtime', 'pdf-worker.exe');
  const command = existsSync(bundled) ? bundled : pythonPath || 'python';
  const args = existsSync(bundled) ? [input] : [join(workerDirectory, 'pdf_worker.py'), input];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      signal,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True',
      },
    });
    let output = '',
      error = '';
    const timeout = setTimeout(() => child.kill(), 600000);
    child.stdout.on('data', (b) => {
      output += b;
      if (output.length > 45 * 1024 * 1024) child.kill();
    });
    child.stderr.on('data', (b) => {
      error = (error + b).slice(-4000);
    });
    const cleanup = () => {
      clearTimeout(timeout);
      try {
        unlinkSync(input);
      } catch {}
    };
    child.on('error', () => {
      cleanup();
      reject(new Error('أداة قراءة PDF غير جاهزة. ثبّت متطلبات Python وحدد مساره من الإعدادات'));
    });
    child.on('close', (code) => {
      cleanup();
      if (code !== 0) return reject(new Error(`تعذرت قراءة PDF: ${error.slice(-600)}`));
      try {
        resolve(JSON.parse(output));
      } catch {
        reject(new Error('أداة قراءة PDF أعادت نتيجة غير صالحة'));
      }
    });
  });
}
