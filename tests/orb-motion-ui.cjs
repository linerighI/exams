const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { resolve, basename } = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const { createServer } = await import('vite');
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const directory = mkdtempSync('.data/orb-motion-');
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    optimizeDeps: {
      noDiscovery: true,
      include: [
        'react',
        'react/jsx-dev-runtime',
        'react-dom/client',
        'lucide-react',
        'katex',
        'zod',
        'motion/react',
        'mathlive',
        '@adi1816/genie-effect',
        '@reduxjs/toolkit',
        'mathjs',
      ],
    },
  });
  let browser;
  try {
    writeFileSync(
      resolve(directory, 'index.html'),
      '<html lang="ar" dir="rtl"><div id="root"></div><script type="module" src="./harness.tsx"></script></html>',
    );
    writeFileSync(
      resolve(directory, 'harness.tsx'),
      `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import FloatingAssistant from '/src/FloatingAssistant';
      import '/src/styles.css';
      import '/src/surfaces.css';
      import '/src/schoolUpgrade.css';
      import '/src/quietWorkspace.css';
      import '@fontsource/tajawal/400.css';
      import '@fontsource/tajawal/700.css';
      createRoot(document.getElementById('root')).render(<FloatingAssistant navigate={()=>{}} openExam={()=>{}} updated={()=>{}} />);
    `,
    );
    await server.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
      console.error('Browser:', error.message);
    });
    await page.route('**/api/**', (route) =>
      route.fulfill({
        json: route.request().url().endsWith('/summary')
          ? { students: 24, ready: 200, active: 0, questions: 200 }
          : { order: [], workflow: ['blueprint', 'writer', 'geometry'] },
      }),
    );
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/.data/${basename(directory)}/index.html`,
    );
    const orb = page.locator('button.assistant-orb');
    const panel = page.locator('.floating-assistant > .orb-chat');
    await orb.click();
    await panel.waitFor();
    await page.waitForFunction(
      () =>
        !document
          .querySelector('.orb-chat')
          .getAnimations()
          .some((a) => a.playState === 'running'),
    );
    const small = await panel.boundingBox();
    await page.getByLabel('تكبير المساعد العائم', { exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('.orb-chat').getBoundingClientRect().width > 900,
    );
    await page.getByLabel('استعادة حجم المساعد', { exact: true }).click();
    await page.waitForFunction(
      () => Math.abs(document.querySelector('.orb-chat').getBoundingClientRect().width - 410) < 1,
    );
    assert.ok(small.width <= 411);
    await page.getByRole('tab', { name: 'المحادثة', exact: true }).click();
    await page.getByLabel('رسالة المساعد العائم').fill('رسالة محفوظة');
    await page.getByLabel('تصغير المساعد العائم', { exact: true }).click();
    await page.locator('.genie-effect-panel').waitFor();
    await page.waitForFunction(() =>
      document.querySelector('.genie-effect-panel')?.style.clipPath.startsWith('polygon'),
    );
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/orb-genie-midpoint.png' });
    await page.locator('.orb-genie-layer').waitFor({ state: 'detached' });
    assert.equal(await panel.count(), 0);
    await orb.click();
    await page.getByLabel('رسالة المساعد العائم').waitFor();
    assert.equal(await page.getByLabel('رسالة المساعد العائم').inputValue(), 'رسالة محفوظة');
    await page.getByRole('tab', { name: 'لهذه الصفحة', exact: true }).click();
    await page.screenshot({ path: 'test-results/orb-motion-open.png' });
    await page.getByRole('button', { name: 'الآلة الحاسبة', exact: true }).click();
    await page.locator('.orb-genie-layer').waitFor({ state: 'detached' });
    const tool = page.locator('.floating-assistant > div > .orb-tool-window');
    await tool.waitFor();
    await tool.getByRole('button', { name: '7', exact: true }).click();
    await tool.getByRole('button', { name: '+', exact: true }).click();
    await tool.getByRole('button', { name: '2', exact: true }).click();
    await tool.getByRole('button', { name: '=', exact: true }).click();
    const result = await tool.getByLabel('نتيجة الآلة الحاسبة').textContent();
    await page.getByLabel('تصغير الأداة', { exact: true }).click();
    await page.locator('.orb-genie-layer').waitFor({ state: 'detached' });
    assert.equal(await tool.isVisible(), false);
    await orb.click();
    await page.getByRole('button', { name: 'استعادة الأداة', exact: true }).click();
    await page.locator('.orb-genie-layer').waitFor({ state: 'detached' });
    await tool.waitFor();
    assert.equal(await tool.getByLabel('نتيجة الآلة الحاسبة').textContent(), result);
    await tool.getByLabel('تكبير الأداة', { exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('.orb-tool-window').getBoundingClientRect().width > 1300,
    );
    await tool.getByLabel('استعادة حجم الأداة', { exact: true }).click();
    await tool.getByLabel('إغلاق الأداة', { exact: true }).click();
    await page.locator('.orb-genie-layer').waitFor({ state: 'detached' });
    assert.equal(await tool.count(), 0);
    // Dragging moves the destination without opening the panel.
    const before = await orb.boundingBox();
    await page.mouse.move(before.x + 35, before.y + 35);
    await page.mouse.down();
    await page.mouse.move(550, 150, { steps: 12 });
    await page.mouse.up();
    assert.equal(await panel.count(), 0);
    const moved = await orb.boundingBox();
    assert.ok(moved.x > 400 && moved.y < 200);
    await orb.click();
    await page.getByLabel('تصغير المساعد العائم', { exact: true }).click();
    await page.locator('.orb-genie-layer').waitFor({ state: 'detached' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 760, height: 900 });
    await orb.click();
    await panel.waitFor();
    await page.getByLabel('تصغير المساعد العائم', { exact: true }).click();
    await panel.waitFor({ state: 'detached' });
    assert.equal(await page.locator('.orb-genie-layer').count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      'Orb motion passed: maximize/restore, genie minimize, chat/tool persistence, dragging, and reduced motion.',
    );
  } finally {
    await browser?.close();
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
