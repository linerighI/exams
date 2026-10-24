import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Camera, ScanLine, Save } from 'lucide-react';
import { BrandTrace } from './BrandMotion';
import { gsap } from './animato';
import './examEntrance.css';
export type ExamEntranceProps = {
  onDone: () => void;
  onPrepared?: () => void;
  ready?: boolean;
  title?: string;
  calculatorAllowed?: boolean;
  geogebraAllowed?: boolean;
};
export default function ExamIntegrityIntro({
  onDone,
  onPrepared,
  ready = true,
  title,
  calculatorAllowed = false,
  geogebraAllowed = false,
}: ExamEntranceProps) {
  const root = useRef<HTMLDialogElement>(null),
    latest = useRef({ onDone, onPrepared }),
    isReady = useRef(ready),
    reveal = useRef<() => void>(() => {});
  latest.current = { onDone, onPrepared };
  isReady.current = ready;
  useLayoutEffect(() => {
    const dialog = root.current!,
      previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.focus();
    let disposed = false,
      prepared = false,
      minimum = false,
      closing = false;
    const prepare = () => {
      if (!disposed && !prepared) {
        prepared = true;
        latest.current.onPrepared?.();
      }
    };
    const context = gsap.context(() => {}, dialog);
    const media = gsap.matchMedia();
    media.add(
      {
        quiet: '(prefers-reduced-motion: reduce)',
        normal: '(prefers-reduced-motion: no-preference)',
      },
      (conditions) => {
        const quiet = !!conditions.conditions?.quiet;
        context.add('openExam', () => {
          if (disposed || closing || !minimum || !isReady.current) return;
          closing = true;
          const exit = gsap.timeline({
            defaults: { ease: 'power3.inOut' },
            onComplete: () => {
              if (!disposed) latest.current.onDone();
            },
          });
          exit
            .to(
              '.entry-center',
              { autoAlpha: 0, y: quiet ? 0 : -18, duration: quiet ? 0.08 : 0.22 },
              0,
            )
            .to(
              '.entry-curtain',
              {
                yPercent: quiet ? 0 : -100,
                autoAlpha: quiet ? 0 : 1,
                duration: quiet ? 0.12 : 0.6,
                ease: 'power3.inOut',
              },
              quiet ? 0 : 0.12,
            )
            .call(
              () => document.dispatchEvent(new Event('zunis:reveal-exam')),
              [],
              quiet ? 0 : 0.3,
            );
        });
        reveal.current = () => context.openExam();
        const circle = dialog.querySelector<SVGCircleElement>('.integrity-trace circle');
        const timeline = gsap.timeline({
          defaults: { ease: 'power3.out', duration: quiet ? 0 : 0.5 },
        });
        timeline
          .addLabel('identity', 0)
          .addLabel('guide', 0.65)
          .addLabel('build', 1.15)
          .addLabel('prepare', 2.05)
          .addLabel('reveal', 2.5);
        if (circle) {
          const length = circle.getTotalLength();
          timeline.fromTo(
            circle,
            { strokeDasharray: length, strokeDashoffset: quiet ? 0 : length },
            { strokeDashoffset: 0, duration: quiet ? 0 : 1.25, ease: 'power2.inOut' },
            'identity',
          );
        }
        timeline
          .from(
            '.entry-camera',
            { autoAlpha: 0, scale: quiet ? 1 : 0.84, duration: quiet ? 0 : 0.3 },
            0,
          )
          .from(
            '.entry-camera-bracket',
            { scale: quiet ? 1 : 1.25, autoAlpha: 0, duration: quiet ? 0 : 0.45 },
            0.05,
          )
          .fromTo(
            '.entry-camera-scan',
            { y: -30, autoAlpha: 0 },
            { y: 30, autoAlpha: quiet ? 0 : 0.9, duration: quiet ? 0 : 0.6, ease: 'power2.inOut' },
            0.1,
          )
          .to(
            '.entry-camera',
            { autoAlpha: 0, scale: quiet ? 1 : 1.08, duration: quiet ? 0 : 0.25 },
            0.65,
          )
          .from(
            '.entry-shield',
            {
              autoAlpha: 0,
              scale: quiet ? 1 : 0.6,
              rotation: quiet ? 0 : -12,
              duration: quiet ? 0 : 0.55,
            },
            0.72,
          )
          .from(
            '.entry-wordmark span',
            {
              autoAlpha: 0,
              y: quiet ? 0 : 25,
              stagger: quiet ? 0 : 0.04,
              duration: quiet ? 0 : 0.5,
            },
            0.9,
          )
          .from(
            '.entry-kicker, .entry-center h1, .entry-description',
            { autoAlpha: 0, y: quiet ? 0 : 10, stagger: quiet ? 0 : 0.07 },
            1.05,
          )
          .from(
            '.entry-feature',
            { autoAlpha: 0, y: quiet ? 0 : 12, stagger: quiet ? 0 : 0.09 },
            1.35,
          )
          .fromTo(
            '.entry-progress span',
            { scaleX: 0 },
            { scaleX: 1, duration: quiet ? 0 : 2.35, ease: 'none' },
            0.1,
          )
          .call(prepare, [], 'prepare')
          .call(
            () => {
              minimum = true;
              reveal.current();
            },
            [],
            'reveal',
          );
        return () => timeline.kill();
      },
      dialog,
    );
    // A delayed animation frame must not trap the student. Loading still waits for real data.
    const fallback = setTimeout(() => {
      prepare();
      minimum = true;
      reveal.current();
    }, 4000);
    return () => {
      disposed = true;
      clearTimeout(fallback);
      reveal.current = () => {};
      media.revert();
      context.revert();
      dialog.close();
      previous?.focus();
    };
  }, []);
  useLayoutEffect(() => {
    if (ready) reveal.current();
  }, [ready]);
  const tools = [
    calculatorAllowed ? 'الآلة الحاسبة' : null,
    geogebraAllowed ? 'GeoGebra' : null,
  ].filter(Boolean);
  return createPortal(
    <dialog
      ref={root}
      className="exam-entry"
      tabIndex={-1}
      aria-label="Zunis · تذكير بالنزاهة"
      aria-describedby="entry-description"
      onCancel={(e) => e.preventDefault()}
      onKeyDown={(e) => e.preventDefault()}
    >
      <div className="entry-curtain" />
      <section className="entry-center">
        <div className="entry-identity">
          <div className="entry-camera" aria-hidden="true">
            <div className="entry-camera-bracket" />
            <Camera size={48} />
            <span className="entry-camera-scan" />
            <small>الكاميرا · حسب إعدادات الامتحان</small>
          </div>
          <div className="entry-shield">
            <BrandTrace />
            <ShieldCheck size={38} />
          </div>
          <span className="entry-wordmark" aria-label="Zunis" dir="ltr">
            {[...'Zunis'].map((letter, i) => (
              <span aria-hidden="true" key={i}>
                {letter}
              </span>
            ))}
          </span>
        </div>
        <p className="entry-kicker">{title || 'مساحتك للتركيز'}</p>
        <h1>ابدأ بثقة. أجب بأمانة.</h1>
        <p id="entry-description" className="entry-description">
          استخدم الأدوات المسموحة فقط. الغش قد يؤدي إلى إلغاء المحاولة.
        </p>
        <div className="entry-features">
          <span className="entry-feature">
            <ScanLine size={16} />
            استخدم الأدوات المسموحة فقط
          </span>
          <span className="entry-feature">
            <Save size={16} />
            حفظ الإجابات تلقائيًا
          </span>
        </div>
        <div className="entry-footer">
          {tools.length ? 'أدواتك: ' + tools.join(' · ') : 'راجع إجاباتك قبل التسليم'}
        </div>
        <div className="entry-progress">
          <span />
        </div>
        <small className="entry-load-status" role="status">
          {ready ? 'مساحتك جاهزة. لنبدأ.' : 'نجهّز صفحة امتحانك…'}
        </small>
      </section>
    </dialog>,
    document.body,
  );
}
