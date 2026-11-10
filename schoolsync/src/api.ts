export async function api<T = unknown>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error || 'Unable to connect'), {
      status: response.status,
    });
  return result;
}
