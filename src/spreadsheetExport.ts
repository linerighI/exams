import { api } from './api';
export async function exportSpreadsheet(kind: 'students' | 'results' | 'template' | 'database') {
  if (window.desktop) return window.desktop.exportSpreadsheet(kind);
  const { data, filename } = await api(`/api/exports/${kind}`);
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
