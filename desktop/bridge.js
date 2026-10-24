(() => {
  if (window !== window.top || location.origin !== 'https://app.alshereqi.invalid') return;
  let sequence = 0;
  const pending = new Map();
  const listeners = new Set();
  const invoke = (method, ...args) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    window.chrome.webview.postMessage({ id, method, args });
  });
  window.chrome.webview.addEventListener('message', ({ data }) => {
    if (data.event === 'server-event') {
      for (const listener of listeners) { try { listener(data.value); } catch (e) { console.error(e); } }
      return;
    }
    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);
    if (data.error) call.reject(new Error(data.error)); else call.resolve(data.result);
  });
  const methods = {
    request: 'request', host: 'host', discover: 'discover', pair: 'pair',
    networkState: 'network-state', networkPreferences: 'network-preferences',
    connectionState: 'connection-state', connectTeacher: 'connect-teacher',
    studentSession: 'student-session',
    updateState: 'update-state', checkUpdates: 'update-check', downloadUpdate: 'update-download',
    cancelUpdate: 'update-cancel', installUpdate: 'update-install',
    chooseBackupFolder:'backup-folder',restartApp:'restart-app',
    saveBackup: 'backup-save', readBackup: 'backup-read', exportCSV: 'export-csv', exportSpreadsheet: 'spreadsheet-save',
    downloadModel: 'model-download', openOllama: 'ollama-download-page',
    openProvider: 'ai-provider-page', exportBankPDF: 'bank-pdf', exportReportPDF: 'report-pdf',
    openTeacherResource: 'teacher-resource', speechStatus: 'speech-status', transcribeSpeech: 'speech-transcribe', synthesizeSpeech: 'speech-synthesize',
  };
  const api = Object.fromEntries(Object.entries(methods).map(([name, method]) => [name, (...args) => invoke(method, ...args)]));
  api.onEvent = callback => { listeners.add(callback); return () => listeners.delete(callback); };
  Object.defineProperty(window, 'desktop', { value: Object.freeze(api), writable: false, configurable: false });
})();
