import { spawnSync } from 'node:child_process';

// DPAPI runs in the native host; secrets never appear in process arguments.
function protect(mode: '--protect' | '--unprotect', input: string): string {
  const executable = process.env.SCHOOL_NATIVE_HOST;
  if (!executable) throw Error('Windows credential protection is unavailable');
  const result = spawnSync(executable, [mode], {
    input, encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw Error('Windows credential protection failed');
  return result.stdout;
}
export const safeStorage = {
  isEncryptionAvailable: () => Boolean(process.env.SCHOOL_NATIVE_HOST),
  encryptString: (value: string) => Buffer.from(protect('--protect', value), 'base64'),
  decryptString: (value: Buffer) => protect('--unprotect', value.toString('base64')),
};
