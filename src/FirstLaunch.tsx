import { Component, lazy, Suspense, useLayoutEffect, useRef, type ReactNode } from 'react';
import { BookOpen, GraduationCap, ArrowLeft, Check, School } from 'lucide-react';
import { gsap } from './animato';
import FocusWindow from './FocusWindow';
import { introductionKey, rememberOnboarding } from './onboardingPolicy';
import type { Session } from './types';
import { api } from './api';
import './onboarding.css';
const Film = lazy(() => import('./OnboardingPlayer'));
class FilmBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="onboarding-unavailable">العرض غير متاح. اختر مساحتك أو اضغط تخطي للمتابعة.</p>
    ) : (
      this.props.children
    );
  }
}
function IntroFilm({
  variant,
  onDone,
  stopped = false,
}: {
  variant: 'overview' | 'teacher' | 'student';
  onDone: () => void;
  stopped?: boolean;
}) {
  return (
    <FilmBoundary>
      <Suspense
        fallback={<div className="onboarding-unavailable">نجهّز لمحة سريعة عن مساحتك…</div>}
      >
        <Film variant={variant} stopped={stopped} onDone={onDone} />
      </Suspense>
    </FilmBoundary>
  );
}
export default function FirstLaunch({ onChoose }: { onChoose: (role: Session['role']) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        gsap.from('.entry-card', { y: 18, opacity: 0, duration: .65, ease: 'power3.out', clearProps: 'all' });
        gsap.from('.entry-choice', { y: 9, opacity: 0, stagger: .09, delay: .2, duration: .45, clearProps: 'all' });
        const film = gsap.timeline();
        timeline.current = film;
        film.from('.entry-sheet', { y: 20, rotation: -3, opacity: 0, duration: .8, ease: 'power3.out' })
          .from('.entry-line', { scaleX: 0, transformOrigin: 'right center', stagger: .12, duration: .45 }, .4)
          .from('.entry-answer', { x: -12, opacity: 0, stagger: .14, duration: .5 }, 1)
          .to('.entry-answer.is-selected', { backgroundColor: '#e3efff', borderColor: '#75a1d8', duration: .5 }, 3)
          .fromTo('.entry-check', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, ease: 'back.out(1.7)', duration: .45 }, 3.3)
          .to('.entry-preview-progress', { scaleX: 1, transformOrigin: 'right center', duration: 9.2, ease: 'none' }, .8)
          .to('.entry-sheet', { y: -3, duration: 1.2, ease: 'sine.inOut' }, 7.5);
        const visibility = () => document.hidden ? film.pause() : film.resume();
        document.addEventListener('visibilitychange', visibility);
        visibility();
        return () => document.removeEventListener('visibilitychange', visibility);
      }, root);
      // Match-media owns the scoped GSAP context and restores all inline styles.
      return () => { context.revert(); timeline.current = null; };
    }, root);
    return () => media.revert();
  }, []);
  return (
    <main ref={root} className="entry-welcome" dir="rtl">
      <section className="entry-card" aria-labelledby="entry-title">
        <div className="entry-main">
          <div className="entry-brand"><span><School size={22}/></span><b>امتحانات</b></div>
          <h1 id="entry-title">أهلًا بك في مساحتك.</h1>
          <p>اختر نوع الدخول، ولنبدأ.</p>
          <div className="entry-choices">
            <button className="entry-choice" onClick={() => onChoose('teacher')}>
              <GraduationCap size={24}/><span><b>أنا معلم</b><small>الأسئلة والامتحانات والنتائج</small></span><ArrowLeft size={18}/>
            </button>
            <button className="entry-choice" onClick={() => onChoose('student')}>
              <BookOpen size={23}/><span><b>أنا طالب</b><small>الدخول إلى امتحاناتي</small></span><ArrowLeft size={18}/>
            </button>
          </div>
        </div>
        <aside className="entry-preview" aria-label="معاينة توضيحية للامتحان">
          <div className="entry-preview-top"><span>لمحة سريعة</span><button onClick={() => timeline.current?.progress(1)}>تخطي</button></div>
          <div className="entry-sheet" aria-hidden="true">
            <div className="entry-sheet-head"><BookOpen size={17}/><span>امتحانك، بكل وضوح</span><small>01 / 05</small></div>
            <h2>خطوة واحدة أقرب.</h2>
            <div className="entry-line"/><div className="entry-line short"/>
            <div className="entry-answer"><i/>الخيار الأول</div>
            <div className="entry-answer is-selected"><i/><span>اختيارك</span><Check className="entry-check" size={16}/></div>
            <div className="entry-answer"><i/>الخيار الثالث</div>
            <div className="entry-sheet-footer"><span>السؤال التالي</span><ArrowLeft size={16}/></div>
          </div>
          <span className="entry-preview-caption">من التحضير إلى التسليم.</span>
          <div className="entry-preview-track"><span className="entry-preview-progress"/></div>
        </aside>
      </section>
      <span className="entry-footnote">يمكنك تغيير نوع الدخول في أي وقت.</span>
    </main>
  );
}
export function AccountIntroduction({
  session,
  school,
  onClose,
}: {
  session: Session;
  school: string;
  onClose: () => void;
}) {
  const finish = () => {
    rememberOnboarding(introductionKey(session, school));
    if (session.role === 'teacher') {
      rememberOnboarding(`teacher-tour:${school}:${session.teacherId || 'master'}`, '1');
      void api('/api/preferences/onboarding', 'PUT', { seen: true }).catch(() => {});
    }
    onClose();
  };
  return (
    <FocusWindow
      title={
        session.role === 'teacher' ? 'أهلًا بك في مساحة المعلم' : 'أهلًا بك في مساحة الطالب'
      }
      onClose={finish}
    >
      <div className="account-introduction" data-intro-role={session.role}>
        <IntroFilm variant={session.role} onDone={finish} />
        <footer>
          <p>
            {session.role === 'teacher'
              ? 'ابدأ بسؤال، ثم انشر امتحانك وتابع النتائج.'
              : 'اختر امتحانك، راقب الوقت، وراجع إجاباتك قبل التسليم.'}
          </p>
          <button autoFocus className="primary" onClick={finish}>
            تخطي والبدء ←
          </button>
        </footer>
      </div>
    </FocusWindow>
  );
}
