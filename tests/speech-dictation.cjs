const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { launch, freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const app = await launch({
    env: {
      SCHOOL_TEST_DATA: resolve(mkdtempSync('.data/offline-speech-')),
      SCHOOL_TEST_PORT: String(await freePort()),
      SCHOOL_HEADLESS_TEST: '1',
    },
  });
  const page = await app.firstWindow(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(60000);
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    assert.equal(
      await page.evaluate(() =>
        window.desktop.speechStatus().then(
          () => false,
          () => true,
        ),
      ),
      true,
    );
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Dictation-test123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.desktop.speechStatus()), {
      engine: 'sherpa-onnx',
      offline: true,
      ready: true,
    });
    for (const [language, text] of [
      ['en', 'Hello teacher. Please help me prepare an exam for my students.'],
      ['ar', 'مرحبا أستاذي. أريد إنشاء امتحان جديد للطلاب.'],
    ]) {
      const began = Date.now();
      const voice = await page.evaluate(
        ([text, language]) => window.desktop.synthesizeSpeech(text, language),
        [text, language],
      );
      const wav = Buffer.from(voice.audio.split(',')[1], 'base64');
      assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
      writeFileSync(`test-results/local-voice-${language}.wav`, wav);
      const result = await page.evaluate(
        async ({ voice, language }) => {
          const context = new AudioContext({ sampleRate: 16000 });
          const bytes = Uint8Array.from(atob(voice.audio.split(',')[1]), (c) => c.charCodeAt(0));
          const decoded = await context.decodeAudioData(bytes.buffer);
          const samples = decoded.getChannelData(0),
            pcm = new Uint8Array(samples.length * 2),
            view = new DataView(pcm.buffer);
          for (let i = 0; i < samples.length; i++)
            view.setInt16(i * 2, Math.max(-32768, Math.min(32767, samples[i] * 32767)), true);
          let binary = '';
          for (let i = 0; i < pcm.length; i += 8192)
            binary += String.fromCharCode(...pcm.subarray(i, i + 8192));
          await context.close();
          return window.desktop.transcribeSpeech(btoa(binary), language);
        },
        { voice, language },
      );
      assert.ok(result.text.trim().length > 3, `Empty ${language} transcription`);
      console.log(
        `${language} real TTS → Whisper: ${JSON.stringify(result.text)} (${Date.now() - began} ms including model loading)`,
      );
      if (language === 'ar')
        await page.evaluate((audio) => {
          window.testVoice = audio;
        }, voice.audio);
    }
    assert.deepEqual(
      await page.evaluate(() => window.desktop.transcribeSpeech(btoa('\0'.repeat(16000)), 'ar')),
      { text: '' },
    );
    assert.equal(
      await page.evaluate(() =>
        window.desktop.transcribeSpeech('invalid!', 'ar').then(
          () => false,
          () => true,
        ),
      ),
      true,
    );
    // Feed real synthesized speech into the actual recording pipeline without a physical microphone.
    await page.evaluate(() => {
      window.testContexts = [];
      navigator.mediaDevices.getUserMedia = async () => {
        const context = new AudioContext({ sampleRate: 16000 }),
          destination = context.createMediaStreamDestination();
        const bytes = Uint8Array.from(atob(window.testVoice.split(',')[1]), (c) => c.charCodeAt(0));
        const source = context.createBufferSource();
        source.buffer = await context.decodeAudioData(bytes.buffer);
        source.connect(destination);
        await context.resume();
        source.start(context.currentTime + 0.5);
        window.testContexts.push(context);
        window.testStream = destination.stream;
        return destination.stream;
      };
      window.testGetUserMedia = navigator.mediaDevices.getUserMedia;
    });
    const text = page.getByLabel('رسالتك للمساعد');
    await text.fill('راجع');
    await page.getByRole('button', { name: 'الإملاء الصوتي', exact: true }).click();
    await page.getByRole('button', { name: 'إيقاف الإملاء الصوتي', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'إرسال', exact: true }).isDisabled(), true);
    await page.waitForTimeout(5500);
    await page.screenshot({ path: 'test-results/assistant-dictation-listening.png' });
    await page.getByRole('button', { name: 'إيقاف الإملاء الصوتي', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('[aria-label="رسالتك للمساعد"]')?.value.length > 4,
    );
    console.log('Recorded draft:', await text.inputValue());
    assert.equal(
      await page.evaluate(() =>
        window.testStream.getTracks().every((t) => t.readyState === 'ended'),
      ),
      true,
    );
    assert.equal(
      (await page.evaluate(() => window.desktop.request('/api/assistant/conversations'))).length,
      0,
    );
    await page.getByLabel('لغة الإملاء الصوتي').selectOption('en');
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('denied', 'NotAllowedError');
      };
    });
    await page.getByRole('button', { name: 'الإملاء الصوتي', exact: true }).click();
    await page
      .getByText('لم يُسمح بالميكروفون. تحقق من أذونات الميكروفون في Windows.', { exact: true })
      .waitFor();
    await text.fill('/دليل');
    await page.getByRole('button', { name: 'إرسال', exact: true }).click();
    const read = page.getByRole('button', { name: 'قراءة الرد بصوت محلي', exact: true }).last();
    await read.waitFor();
    // Silence playback in automation; real synthesis is exercised above.
    await page.evaluate(() => {
      window.Audio = class {
        constructor(src) {
          if (!src.startsWith('data:audio/wav;base64,')) throw Error('Invalid speech audio');
          window.playedSpeech = true;
        }
        async play() {}
        pause() {}
        set src(v) {
          if (!v) this.onemptied?.();
        }
      };
    });
    await read.click();
    await page.waitForFunction(() => window.playedSpeech === true);
    await page.getByRole('button', { name: 'إيقاف قراءة الرد', exact: true }).click();
    await page.getByRole('button', { name: 'قراءة الرد بصوت محلي', exact: true }).last().waitFor();
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = window.testGetUserMedia;
    });
    await page.getByRole('button', { name: 'الإملاء الصوتي', exact: true }).click();
    await page.getByRole('button', { name: 'إيقاف الإملاء الصوتي', exact: true }).waitFor();
    await page
      .locator('.sidebar nav')
      .getByRole('button', { name: 'الامتحانات', exact: true })
      .click();
    await page.waitForFunction(() =>
      window.testStream.getTracks().every((t) => t.readyState === 'ended'),
    );
    await page.getByRole('button', { name: 'المساعد العائم', exact: true }).click();
    await page.getByRole('tab', {name:'المحادثة',exact:true}).click();
    await page
      .locator('.orb-composer')
      .getByRole('button', { name: 'الإملاء الصوتي', exact: true })
      .waitFor();
    const denied = await page.evaluate(async () => {
      await Promise.all(window.testContexts.map((c) => c.close()));
      const student = await window.desktop.request('/api/students', 'POST', {
        id: 's1',
        name: 'طالب',
        grade: '10',
        section: 'أ',
      });
      await window.desktop.request('/api/login', 'POST', { role: 'student', code: student.code });
      const blocked = await Promise.all(
        [
          window.desktop.speechStatus(),
          window.desktop.transcribeSpeech(btoa('\0'.repeat(16000)), 'ar'),
          window.desktop.synthesizeSpeech('مرحبا', 'ar'),
        ].map((p) =>
          p.then(
            () => false,
            () => true,
          ),
        ),
      );
      await window.desktop.request('/api/logout', 'POST', { password: 'Dictation-test123' });
      return blocked;
    });
    assert.deepEqual(denied, [true, true, true]);
    assert.deepEqual(errors, []);
    console.log(
      'Offline speech passed: real Arabic/English synthesis/transcription, recording pipeline, draft review, silence, invalid input, permission denial, readback controls, both composers and teacher-only authorization. Physical microphone accuracy not tested.',
    );
  } catch (e) {
    await page.screenshot({ path: 'test-results/dictation-failure.png' }).catch(() => {});
    console.error(app.diagnostics());
    throw e;
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
