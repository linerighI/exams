/** Bound concurrent school-server requests per desktop without reusing unverified TLS sockets. */
export function createRequestQueue(limit = 4) {
  if (!Number.isInteger(limit) || limit < 1)
    throw new RangeError('Request limit must be a positive integer');
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(request: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      const enter = () => {
        active++;
        resolve();
      };
      if (active < limit) enter();
      else waiting.push(enter);
    });
    try {
      return await request();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}
