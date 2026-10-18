const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, readFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const ExcelJS = require('exceljs');
const { launch, freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  const directory = mkdtempSync(resolve('.data/personalization-native-'));
  const output = join(directory, 'exports');
  const wav = Buffer.alloc(16044);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(16000, 40);
  const app = await launch({ args: ['--fake-camera'], env: {
    SCHOOL_TEST_DATA: directory, SCHOOL_TEST_PORT: String(await freePort()),
    SCHOOL_HEADLESS_TEST: '1', SCHOOL_TEST_SAVE_DIR: output,
  }});
  try {
    const page = await app.firstWindow();
    const result = await page.evaluate(async data => {
      await window.desktop.host();
      await window.desktop.request('/api/setup', 'POST', { school: 'مدرسة الصوت والمظهر', password: 'Native-media123' });
      await window.desktop.request('/api/login', 'POST', { role: 'teacher', password: 'Native-media123' });
      const student = await window.desktop.request('/api/students', 'POST', { id: 'native-media-student', name: 'طالب الصوت', grade: '10', section: 'أ' });
      const exam = await window.desktop.request('/api/exams', 'POST', {
        title: 'امتحان صوتي', subject: 'رياضيات', grade: '10', section: 'أ', term: 'الأول', kind: 'نصفي',
        duration: 30, total: 20, difficulty: 'سهل', cameraRequired: false,
        opensAt: new Date(Date.now()-60000).toISOString(), closesAt: new Date(Date.now()+3600000).toISOString(),
        appearance: { accent: '#166855', background: '#f1f8f4', cardStyle: 'outlined', fontSize: 'large', welcome: 'مرحبًا بكم' },
        audio: { name: 'تعليمات.wav', data },
        questions: [{ id: 'q1', text: '2+3؟', options: ['1','2','5','6'], correct: 2, explanation: 'جمع', page: 1 }],
      });
      await window.desktop.request(`/api/exams/${exam.id}/publish`, 'POST', {});
      const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
      const recorder = new MediaRecorder(stream), chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      const recorded = new Promise(resolve => recorder.onstop = () => resolve(new Blob(chunks).size));
      recorder.start(); await new Promise(resolve => setTimeout(resolve, 1100)); recorder.stop();
      const recordedBytes = await recorded; stream.getTracks().forEach(t => t.stop());
      await window.desktop.exportSpreadsheet('database');
      await window.desktop.request('/api/logout', 'POST', {});
      await window.desktop.request('/api/login', 'POST', {role: 'student', code: student.code});
      const attempt = await window.desktop.request('/api/attempts/start', 'POST', {examId: exam.id, cameraAvailable: false});
      const audio = document.createElement('audio'); audio.muted = true; audio.controls = true;
      audio.src = attempt.exam.audio.data; document.body.append(audio);
      await audio.play(); await new Promise(resolve => setTimeout(resolve, 250));
      const played = audio.currentTime > .1; audio.pause(); audio.remove();
      return {recordedBytes, played, appearance: attempt.exam.appearance};
    }, 'data:audio/wav;base64,' + wav.toString('base64'));
    assert.ok(result.recordedBytes > 0);
    assert.equal(result.played, true);
    assert.equal(result.appearance.accent, '#166855');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(readFileSync(join(output, 'database.xlsx')));
    assert.ok(workbook.getWorksheet('Manifest').rowCount >= 3);
    assert.ok(workbook.getWorksheet('Database Chunks').rowCount >= 3);
    console.log('Native WebView2 passed: real Excel save bridge, teacher microphone recording, student data-audio playback under app CSP, and saved exam appearance.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
