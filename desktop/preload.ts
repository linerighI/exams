import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('desktop', {
  request: (path: string, method?: string, body?: unknown) =>
    ipcRenderer.invoke('request', path, method, body),
  host: () => ipcRenderer.invoke('host'),
  discover: () => ipcRenderer.invoke('discover'),
  pair: (host: string, code: string) => ipcRenderer.invoke('pair', host, code),
  saveBackup: () => ipcRenderer.invoke('backup-save'),
  readBackup: () => ipcRenderer.invoke('backup-read'),
  exportCSV: (csv: string) => ipcRenderer.invoke('export-csv', csv),
  downloadModel: (model: string) => ipcRenderer.invoke('model-download', model),
  openOllama: () => ipcRenderer.invoke('ollama-download-page'),
  openProvider: (provider: string) => ipcRenderer.invoke('ai-provider-page', provider),
  exportBankPDF: (bookId: string) => ipcRenderer.invoke('bank-pdf', bookId),
  onEvent: (callback: (event: any) => void) => {
    const listener = (_event: any, value: any) => callback(value);
    ipcRenderer.on('server-event', listener);
    return () => ipcRenderer.removeListener('server-event', listener);
  },
});
