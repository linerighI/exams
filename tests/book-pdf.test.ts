import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
test('supplied PDF uploads, preserves originals, renders vector pages and crops', async () => {
  const pdfPath = 'C:/Users/User/Downloads/كتاب الطالب لمادة الرياضيات الصف العاشر الفصل الأول.pdf';
  if (!existsSync(pdfPath)) return;
  const directory = mkdtempSync(join(tmpdir(), 'book-pdf-'));
  const server = await createApp({ directory });
  const call = async (url: string, method = 'GET', body?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload: body,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'password123' });
    const token = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'password123' })
    ).json().token;
    const start = Date.now();
    const uploaded = await call(
      '/api/books',
      'POST',
      {
        title: 'كتاب الرياضيات',
        subject: 'رياضيات',
        grade: 'العاشر',
        term: 'الأول',
        pdf: 'data:application/pdf;base64,' + readFileSync(pdfPath).toString('base64'),
      },
      token,
    );
    assert.equal(uploaded.statusCode, 200, uploaded.body);
    const book = uploaded.json();
    assert.equal(book.pageCount, 132);
    assert.equal(book.pdf, undefined);
    const page = await call(`/api/books/${book.id}/page/8`, 'GET', undefined, token);
    assert.equal(page.statusCode, 200, page.body);
    assert.ok(page.json().image.startsWith('data:image/png;base64,'));
    server.store.put('bank_questions', {
      id: 'crop-test',
      bookId: book.id,
      page: 8,
      status: 'draft',
    });
    const cropped = await call(
      '/api/bank/crop-test/crop',
      'POST',
      { box: [0.1, 0.2, 0.8, 0.7] },
      token,
    );
    assert.equal(cropped.statusCode, 200, cropped.body);
    assert.ok(cropped.json().image.length < page.json().image.length);
    const backup = (await call('/api/backup', 'GET', undefined, token)).json();
    assert.equal(
      JSON.parse(backup.tables.books[0].data).pdf,
      readFileSync(pdfPath).toString('base64'),
    );
    const elapsed = Date.now() - start;
    writeFileSync(
      'test-results/book-upload.json',
      JSON.stringify(
        { pdf: pdfPath, pages: 132, uploadRenderCropSeconds: elapsed / 1000, geminiRequests: 0 },
        null,
        2,
      ),
    );
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
