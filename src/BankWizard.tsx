import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Copy,
  ArrowUpLeft,
  FileJson,
  CheckCircle2,
  Sparkles,
  BookOpen,
  UploadCloud,
  Loader2,
} from 'lucide-react';
import { api, fileBase64 } from './api';
import { bankPrompt, providers, type BankMeta } from './bankExchange';
import MathText from './MathText';
import { svgToPng } from './svgDiagram';
export default function BankWizard({
  books,
  onImported,
  notify,
}: {
  books: any[];
  onImported: (id: string) => Promise<void>;
  notify: (s: string) => void;
}) {
  const [step, setStep] = useState(0),
    [meta, setMeta] = useState<BankMeta>({ title: '', subject: '', grade: '', term: 'الأول' }),
    [count, setCount] = useState(200),
    [range, setRange] = useState(''),
    [difficulty, setDifficulty] = useState('مختلط'),
    [provider, setProvider] = useState<keyof typeof providers>('gemini'),
    [data, setData] = useState<any>(),
    [preview, setPreview] = useState<any>(),
    [bookId, setBookId] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [copied, setCopied] = useState(false),
    [done, setDone] = useState<any>();
  const [customPrompt, setCustomPrompt] = useState<string>(),
    [instructions, setInstructions] = useState(''),
    [proposal, setProposal] = useState('');
  const prompt = customPrompt ?? bankPrompt(meta, count, range, difficulty);
  useEffect(() => {
    void api('/api/bank/prompt')
      .then((r) => {
        if (r.prompt) setCustomPrompt(r.prompt);
      })
      .catch(() => {});
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const changeTarget = (id: string) => {
    setBookId(id);
    setPreview(undefined);
  };
  return (
    <section className="exchange-studio" aria-label="إنشاء بنك أسئلة">
      <div className="exchange-heading">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} /> من كتابك إلى بنك قابل لإعادة الاستخدام
          </span>
          <h2>كل درس، بداية لسؤال جيد.</h2>
          <p>حضّر طلبك، استخدم حسابك على موقع المساعد، ثم أعد الأسئلة إلى مكتبتك.</p>
        </div>
        <div className="exchange-badge">
          <FileJson size={25} />
          <span>
            PDF + JSON<small>استيراد ومعادلات وقص محلي</small>
          </span>
        </div>
      </div>
      <nav className="exchange-steps" aria-label="خطوات استيراد البنك">
        {['جهّز الطلب', 'افتح المساعد', 'استورد البنك'].map((name, i) => (
          <button
            key={name}
            className={step === i ? 'active' : ''}
            aria-current={step === i ? 'step' : undefined}
            onClick={() => setStep(i)}
          >
            <span>{i + 1}</span>
            {name}
            <small>
              {['تفاصيل الكتاب والهدف', 'راجع الطلب وافتح المساعد', 'راجع واحفظ الأسئلة'][i]}
            </small>
          </button>
        ))}
      </nav>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="exchange-body"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.18 }}
        >
          {step === 0 && (
            <div className="exchange-setup">
              <div className="exchange-fields">
                {(['title', 'subject', 'grade'] as const).map((key, i) => (
                  <label className="field" key={key}>
                    {['عنوان الكتاب', 'المادة', 'الصف'][i]}
                    <input
                      aria-label={`طلب البنك: ${['عنوان الكتاب', 'المادة', 'الصف'][i]}`}
                      value={meta[key]}
                      onChange={(e) => {
                        setMeta({ ...meta, [key]: e.target.value });
                        setCopied(false);
                      }}
                      placeholder={['كتاب الطالب', 'الرياضيات', 'العاشر'][i]}
                    />
                  </label>
                ))}
                <label className="field">
                  الفصل الدراسي
                  <select
                    value={meta.term}
                    onChange={(e) => setMeta({ ...meta, term: e.target.value })}
                  >
                    <option>الأول</option>
                    <option>الثاني</option>
                  </select>
                </label>
                <label className="field">
                  هدف البنك
                  <input
                    type="number"
                    aria-label="هدف البنك الخارجي"
                    min={50}
                    max={500}
                    value={count}
                    onChange={(e) => setCount(+e.target.value)}
                  />
                </label>
                <label className="field">
                  الصعوبة
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    {['مختلط', 'سهل', 'متوسط', 'صعب'].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="field range-field">
                  صفحات PDF الأصلية
                  <input
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    placeholder="مثل 8–64، أو اتركه لجميع الدروس"
                  />
                  <small>المواضع في الملف، وليست أرقام الصفحات المطبوعة.</small>
                </label>
                <button
                  className="primary"
                  disabled={
                    !meta.title.trim() ||
                    !meta.subject.trim() ||
                    !meta.grade.trim() ||
                    count < 50 ||
                    count > 500 ||
                    !Number.isInteger(count)
                  }
                  onClick={() => setStep(1)}
                >
                  جهّز رحلتك <ArrowUpLeft size={17} />
                </button>
              </div>
              <div className="exchange-illustration">
                <div className="exchange-paper">
                  <BookOpen size={34} />
                  <strong>
                    كتاب واحد.
                    <br />
                    مئات الفرص للتعلّم.
                  </strong>
                  <span>بنك كامل في ملف واحد</span>
                  <i>أ ب ج</i>
                </div>
                <div className="exchange-floating">
                  <CheckCircle2 size={20} /> محفوظ على جهاز المعلم
                </div>
                <p>
                  يبقى الكتاب على جهازك؛ ترفعه بنفسك إلى الموقع الذي تختاره. التطبيق لا يرسله
                  تلقائيًا.
                </p>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="exchange-provider">
              <div>
                <h3>اختر مساحة التفكير</h3>
                <p>راجع الطلب وعدّله، ثم انسخه وارفع كتابك على الموقع الذي تختاره.</p>
                <div className="provider-choices">
                  {Object.entries(providers).map(([key, p]) => (
                    <button
                      key={key}
                      className={provider === key ? 'active' : ''}
                      onClick={() => setProvider(key as keyof typeof providers)}
                    >
                      <Sparkles size={19} />
                      <strong>{p.name}</strong>
                      <span>
                        افتح في متصفحك <ArrowUpLeft size={13} />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="button-row">
                  <button
                    className="primary"
                    onClick={() =>
                      void run(async () => {
                        await api('/api/bank/prompt', 'PUT', { prompt });
                        await navigator.clipboard.writeText(prompt);
                        setCopied(true);
                      })
                    }
                  >
                    <Copy size={16} />
                    {copied ? 'تم نسخ الطلب' : 'نسخ الطلب'}
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      void run(async () => {
                        if (window.desktop) await window.desktop.openProvider(provider);
                        else window.open(providers[provider].url, '_blank', 'noopener,noreferrer');
                      })
                    }
                  >
                    فتح {providers[provider].name}
                    <ArrowUpLeft size={16} />
                  </button>
                </div>
                <ol className="exchange-instructions">
                  <li>الصق الطلب وارفع كتابك على الموقع بنفسك.</li>
                  <li>اطلب البنك كاملًا ونزّل JSON والرسوم والـ PDF المتاح.</li>
                  <li>ارجع هنا للاستيراد. يمكن للتطبيق إنشاء PDF إن لم ينتجه الموقع.</li>
                </ol>
                <button className="text-button" onClick={() => setStep(2)}>
                  الملفات جاهزة؟ استورد البنك ←
                </button>
              </div>
              <div className="prompt-workbench">
                <label className="field prompt-preview">
                  طلبك — قابل للتعديل
                  <textarea
                    aria-label="معاينة الطلب"
                    value={prompt}
                    onChange={(e) => {
                      setCustomPrompt(e.target.value);
                      setCopied(false);
                    }}
                  />
                </label>
                <div className="button-row">
                  <button
                    className="secondary"
                    disabled={busy || !prompt.trim()}
                    onClick={() =>
                      void run(async () => {
                        await api('/api/bank/prompt', 'PUT', { prompt });
                        notify('حُفظ طلبك');
                      })
                    }
                  >
                    حفظ الطلب
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      setCustomPrompt(undefined);
                      setProposal('');
                    }}
                  >
                    استعادة القالب
                  </button>
                </div>
                <div className="prompt-ai-editor">
                  <h3>
                    <Sparkles size={17} />
                    عدّل الطلب مع المساعد
                  </h3>
                  <label className="field">
                    ماذا تريد تغييره؟
                    <textarea
                      aria-label="تعليمات تعديل الطلب"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="مثلًا: ركز على المسائل التطبيقية وأضف رسومًا لكل سؤال هندسي"
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={busy || !instructions.trim()}
                    onClick={() =>
                      void run(async () => {
                        setProposal(
                          (await api('/api/bank/prompt/rewrite', 'POST', { prompt, instructions }))
                            .prompt,
                        );
                      })
                    }
                  >
                    اقتراح تعديل
                  </button>
                  {proposal && (
                    <div className="prompt-proposal">
                      <label className="field">
                        اقتراح المساعد
                        <textarea aria-label="اقتراح الطلب" value={proposal} readOnly />
                      </label>
                      <div className="button-row">
                        <button
                          className="primary"
                          onClick={() => {
                            setCustomPrompt(proposal);
                            setProposal('');
                            setCopied(false);
                          }}
                        >
                          تطبيق التعديل
                        </button>
                        <button className="text-button" onClick={() => setProposal('')}>
                          تجاهل
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="exchange-import">
              <div>
                <h3>أعد المعرفة إلى مكتبتك</h3>
                <p>JSON هو مصدر الأسئلة القابل للتعديل. ملف PDF المرافق للقراءة فقط.</p>
                <label className="field">
                  مكان حفظ البنك
                  <select
                    aria-label="بنك الاستيراد"
                    value={bookId}
                    onChange={(e) => changeTarget(e.target.value)}
                  >
                    <option value="">بنك جديد من بيانات الملف</option>
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} · {b.questions} سؤال
                      </option>
                    ))}
                  </select>
                </label>
                <label className="exchange-drop">
                  <FileJson size={28} />
                  <strong>اختر ملف JSON</strong>
                  <small>حتى 8 ميجابايت · 500 سؤال في الملف</small>
                  <input
                    aria-label="ملف JSON للبنك"
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setPreview(undefined);
                      setDone(undefined);
                      setData(undefined);
                      if (file)
                        void run(async () => {
                          if (file.size > 8 * 1024 * 1024)
                            throw Error('ملف JSON أكبر من 8 ميجابايت');
                          let parsed;
                          try {
                            parsed = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
                          } catch {
                            throw Error(
                              'الملف ليس JSON صالحًا. اطلب من الموقع ملف JSON قابلًا للتنزيل دون نص إضافي.',
                            );
                          }
                          for (const q of Array.isArray(parsed.questions) ? parsed.questions : []) {
                            if (q.svg)
                              try {
                                Object.assign(q, await svgToPng(q.svg));
                              } catch {
                                /* The server reports this diagram for repair. */
                              }
                          }
                          setData(parsed);
                        });
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  className="secondary wide"
                  disabled={!data || busy}
                  onClick={() =>
                    void run(async () => {
                      setPreview(
                        await api('/api/bank/import/preview', 'POST', {
                          data,
                          bookId: bookId || undefined,
                        }),
                      );
                    })
                  }
                >
                  معاينة الاستيراد
                </button>
                <label className="secondary file-button">
                  إرفاق رسوم SVG
                  <input
                    aria-label="رسوم SVG للبنك"
                    type="file"
                    accept=".svg,image/svg+xml"
                    multiple
                    disabled={!data || busy}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      e.target.value = '';
                      void run(async () => {
                        const updated = structuredClone(data);
                        let matched = 0;
                        for (const file of files) {
                          if (file.size > 100000) throw Error('ملف SVG أكبر من 100 كيلوبايت');
                          const q = updated.questions.find(
                            (q: any) => q.id === file.name.replace(/\.svg$/i, ''),
                          );
                          if (!q) continue;
                          Object.assign(q, await svgToPng(await file.text()), {
                            requiresImage: true,
                          });
                          matched++;
                        }
                        if (!matched) throw Error('سمّ ملفات الرسوم بمعرف السؤال، مثل q-001.svg');
                        setData(updated);
                        setPreview(undefined);
                        notify(`أُرفق ${matched} رسمًا`);
                      });
                    }}
                  />
                </label>
                <small>تُحفظ الأسئلة كمسودات للمراجعة والاعتماد.</small>
                {done && (
                  <div className="import-done" role="status">
                    <CheckCircle2 />
                    <strong>حُفظ {done.imported} سؤالًا</strong>
                    <span>
                      {done.skipped} متجاوز · {done.repairNeeded} يحتاج مراجعة إضافية
                    </span>
                    <label className="secondary file-button">
                      <UploadCloud size={16} /> إرفاق PDF المرافق (اختياري)
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            void run(async () => {
                              await api(`/api/books/${done.bookId}/companion`, 'POST', {
                                pdf: await fileBase64(file),
                              });
                              notify('حُفظ PDF المرافق ضمن النسخ الاحتياطي');
                            });
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
              <div className="import-preview">
                {!preview ? (
                  <div className="empty">
                    <FileJson size={44} />
                    <h3>تعرّف على البنك قبل حفظه</h3>
                    <p>سنفحص الخيارات والإجابات والمصادر والتكرار. صحة المحتوى تحتاج مراجعتك.</p>
                  </div>
                ) : (
                  <>
                    <h3>{preview.data.book.title}</h3>
                    <div className="import-metrics">
                      <span>
                        <b>{preview.accepted.length}</b>صالح للاستيراد
                      </span>
                      <span>
                        <b>{preview.duplicates.length}</b>مكرر
                      </span>
                      <span>
                        <b>{preview.rejected.length}</b>غير صالح
                      </span>
                      <span>
                        <b>{preview.repairNeeded}</b>يحتاج إصلاحًا
                      </span>
                    </div>
                    <div className="import-samples">
                      {preview.accepted.slice(0, 5).map((q: any) => (
                        <article key={q.sourceIndex}>
                          <small>
                            سؤال {q.sourceIndex} · صفحة {q.page}
                          </small>
                          <MathText text={q.text} />
                          {q.image && (
                            <img
                              className="import-diagram-preview"
                              src={q.image}
                              alt="رسم السؤال المستورد"
                            />
                          )}
                          {q.reviewWarnings.map((w: string, i: number) => (
                            <small className="import-warning" key={i}>
                              {w}
                            </small>
                          ))}
                        </article>
                      ))}
                      {[...preview.rejected, ...preview.duplicates].map((r: any, i: number) => (
                        <p key={i} className="import-warning">
                          سؤال {r.index}: {r.message}
                        </p>
                      ))}
                    </div>
                    <button
                      className="primary wide"
                      disabled={busy || !preview.accepted.length || !!done}
                      onClick={() =>
                        void run(async () => {
                          const result = await api('/api/bank/import/commit', 'POST', {
                            data,
                            bookId: bookId || undefined,
                          });
                          setDone(result);
                          setBookId(result.bookId);
                          setPreview(undefined);
                          await onImported(result.bookId);
                        })
                      }
                    >
                      حفظ البنك كمسودات <CheckCircle2 size={17} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {busy && (
        <p className="exchange-status" role="status">
          <Loader2 className="spin" size={16} /> جارٍ التنفيذ محليًا…
        </p>
      )}
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
