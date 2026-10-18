import { useEffect, useRef, useState } from 'react';
import { Download, Eye, FileText, Loader2 } from 'lucide-react';
import { api } from './api';
import FocusWindow from './FocusWindow';
import type { BankPDFOptions, ReportOptions } from './pdfOptions';
import './pdfExport.css';

export function bankDocumentURL(id: string, options: BankPDFOptions) {
  return `/api/books/${id}/document?${new URLSearchParams({ audience: options.audience, approvedOnly: String(options.approvedOnly), chapter: options.chapter, title: options.title })}`;
}
async function browserPrint(html: string) {
  const frame = document.createElement('iframe');
  frame.title = 'نسخة الطباعة';
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
  const loaded = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      frame.remove();
      reject(Error('تعذر تحميل نسخة الطباعة'));
    }, 60000);
    frame.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
  });
  frame.srcdoc = html;
  document.body.appendChild(frame);
  try {
    await loaded;
    await frame.contentDocument!.fonts.ready;
    await Promise.all(
      [...frame.contentDocument!.images].map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = img.onerror = () => resolve();
            }),
      ),
    );
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 60000);
  } catch (error) {
    frame.remove();
    throw error;
  }
}
const sections = [
  ['students', 'الطلاب وبيانات الدخول'],
  ['results', 'العلامات والمحاولات'],
  ['exams', 'الامتحانات وإعداداتها'],
  ['banks', 'فهرس بنوك الأسئلة'],
  ['activity', 'سجل العمليات'],
  ['accounts', 'حسابات المعلمين'],
] as const;

export default function PDFExport({
  bank,
  notify,
}: {
  bank?: { id: string; title: string; chapters?: string[] };
  notify: (message: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [html, setHTML] = useState(''),
    [error, setError] = useState('');
  const [bankOptions, setBank] = useState<BankPDFOptions>({
    audience: 'teacher',
    approvedOnly: true,
    chapter: '',
    title: bank?.title || '',
  });
  const [reportOptions, setReport] = useState<ReportOptions>({
    sections: ['students', 'results', 'exams', 'banks', 'activity', 'accounts'],
    includeLoginCodes: false,
    includeAnswerDetails: false,
    includeArchived: true,
  });
  const generation = useRef(0);
  const key = JSON.stringify(bank ? bankOptions : reportOptions);
  useEffect(() => {
    setBank({ audience: 'teacher', approvedOnly: true, chapter: '', title: bank?.title || '' });
  }, [bank?.id]);
  useEffect(() => {
    generation.current++;
    setHTML('');
    setError('');
  }, [key, open]);
  const documentHTML = async () =>
    (
      await (bank
        ? api(bankDocumentURL(bank.id, bankOptions))
        : api('/api/reports/document', 'POST', reportOptions))
    ).html as string;
  const run = async (save: boolean) => {
    setBusy(true);
    setError('');
    const version = generation.current;
    try {
      if (save && window.desktop) {
        const saved = bank
          ? await window.desktop.exportBankPDF(bank.id, bankOptions)
          : await window.desktop.exportReportPDF(reportOptions);
        if (saved) notify('حُفظ ملف PDF');
      } else {
        const content = html || (await documentHTML());
        if (version === generation.current) setHTML(content);
        if (save) await browserPrint(content);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button className="secondary" onClick={() => setOpen(true)}>
        <FileText size={17} />
        {bank ? 'تصدير بنك PDF محليًا' : 'تصدير بيانات المدرسة PDF'}
      </button>
      {open && (
        <FocusWindow
          title={bank ? 'تصميم وتصدير بنك الأسئلة' : 'تقرير بيانات المدرسة PDF'}
          wide
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div className="pdf-export" dir="rtl">
            <div className="pdf-export-controls">
              <div className="pdf-export-intro">
                <FileText />
                <div>
                  <h2>{bank ? 'ورقة أنيقة جاهزة للطباعة' : 'بيانات مدرستك في تقرير واحد'}</h2>
                  <p>تنسيق A4 عربي، مع خطوط ورسوم مضمّنة يعمل دون إنترنت.</p>
                </div>
              </div>
              <fieldset disabled={busy}>
                {bank ? (
                  <>
                    <label>
                      عنوان المستند
                      <input
                        maxLength={200}
                        value={bankOptions.title}
                        onChange={(e) => setBank({ ...bankOptions, title: e.target.value })}
                      />
                    </label>
                    <label>
                      نوع النسخة
                      <select
                        value={bankOptions.audience}
                        onChange={(e) =>
                          setBank({
                            ...bankOptions,
                            audience: e.target.value as 'teacher' | 'student',
                          })
                        }
                      >
                        <option value="teacher">للمعلم · الأسئلة ومفتاح الإجابة</option>
                        <option value="student">للطالب · الأسئلة فقط</option>
                      </select>
                    </label>
                    <label>
                      الموضوع
                      <select
                        value={bankOptions.chapter}
                        onChange={(e) => setBank({ ...bankOptions, chapter: e.target.value })}
                      >
                        <option value="">جميع الموضوعات</option>
                        {bank.chapters?.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="pdf-check">
                      <input
                        type="checkbox"
                        checked={bankOptions.audience === 'student' || bankOptions.approvedOnly}
                        disabled={bankOptions.audience === 'student'}
                        onChange={(e) =>
                          setBank({ ...bankOptions, approvedOnly: e.target.checked })
                        }
                      />
                      الأسئلة المعتمدة فقط
                    </label>
                    <p className="muted">
                      نسخة الطالب تستبعد المسودات والإجابات دائمًا. نسخة المعلم تضع مفتاح الإجابة في
                      صفحات مستقلة.
                    </p>
                  </>
                ) : (
                  <>
                    <legend>أقسام التقرير</legend>
                    <div className="pdf-sections">
                      {sections.map(([id, label]) => (
                        <label className="pdf-check" key={id}>
                          <input
                            type="checkbox"
                            checked={reportOptions.sections.includes(id)}
                            onChange={(e) =>
                              setReport({
                                ...reportOptions,
                                sections: e.target.checked
                                  ? [...reportOptions.sections, id]
                                  : reportOptions.sections.filter((s) => s !== id),
                              })
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <label className="pdf-check">
                      <input
                        type="checkbox"
                        checked={reportOptions.includeLoginCodes}
                        onChange={(e) =>
                          setReport({ ...reportOptions, includeLoginCodes: e.target.checked })
                        }
                      />
                      تضمين رموز دخول الطلاب ورموز الامتحانات
                    </label>
                    <label className="pdf-check">
                      <input
                        type="checkbox"
                        checked={reportOptions.includeAnswerDetails}
                        onChange={(e) =>
                          setReport({ ...reportOptions, includeAnswerDetails: e.target.checked })
                        }
                      />
                      تفاصيل إجابات كل طالب والأسئلة والرسوم
                    </label>
                    <label className="pdf-check">
                      <input
                        type="checkbox"
                        checked={reportOptions.includeArchived}
                        onChange={(e) =>
                          setReport({ ...reportOptions, includeArchived: e.target.checked })
                        }
                      />
                      تضمين المحاولات المؤرشفة
                    </label>
                    <p className="info-note">
                      ضمن صلاحيات حسابك. كلمات المرور والأرقام الوطنية المحمية غير قابلة للاسترجاع.
                      لحفظ الملفات الأصلية والصور الرقابية والمحادثات استخدم النسخة الاحتياطية JSON.
                    </p>
                    {reportOptions.includeLoginCodes && (
                      <p className="pdf-sensitive">
                        التقرير يتضمن بيانات دخول خاصة. احفظه لدى المعلم فقط.
                      </p>
                    )}
                  </>
                )}
              </fieldset>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <div className="pdf-export-actions">
                <button
                  className="secondary"
                  disabled={busy || (!bank && !reportOptions.sections.length)}
                  onClick={() => void run(false)}
                >
                  <Eye size={17} />
                  معاينة المستند
                </button>
                <button
                  className="primary"
                  disabled={busy || (!bank && !reportOptions.sections.length)}
                  onClick={() => void run(true)}
                >
                  {busy ? <Loader2 className="spin" size={17} /> : <Download size={17} />}حفظ PDF
                </button>
              </div>
              <p className="muted">
                {window.desktop
                  ? 'يُحفظ الملف في المكان الذي تختاره على هذا الجهاز.'
                  : 'من نافذة الطباعة اختر «حفظ بتنسيق PDF».'}
              </p>
            </div>
            <div className="pdf-preview">
              {html ? (
                <iframe title="معاينة PDF" sandbox="" srcDoc={html} />
              ) : (
                <div className="pdf-preview-empty">
                  <FileText size={40} />
                  <h3>معاينة قبل الحفظ</h3>
                  <p>اختر المحتوى واضغط معاينة المستند.</p>
                </div>
              )}
            </div>
          </div>
        </FocusWindow>
      )}
    </>
  );
}
