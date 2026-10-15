let token = sessionStorage.getItem('school-token') || '';
export const setToken = (value: string) => {
  token = value;
  sessionStorage.setItem('school-token', value);
};
export async function api(path: string, method = 'GET', body?: unknown): Promise<any> {
  if (window.desktop) {
    try {
      return await window.desktop.request(path, method, body);
    } catch (error) {
      throw Error(
        (error as Error).message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''),
      );
    }
  }
  const response = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'تعذر تنفيذ العملية');
  return result;
}
export function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
