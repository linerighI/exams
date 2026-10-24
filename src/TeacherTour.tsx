import { useEffect, useRef, useState } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { CircleHelp, GraduationCap } from 'lucide-react';
import { api } from './api';
import FocusWindow from './FocusWindow';
import './comfort.css';
export default function TeacherTour({ teacherId,enabled=true }: { teacherId: string;enabled?:boolean }) {
  const [welcome, setWelcome] = useState(false);
  const tour = useRef<Driver | undefined>(undefined);
  const marker = `teacher-tour:${localStorage.getItem('school-scope') || 'development'}:${teacherId}`;
  const remember = async () => {
    // A local marker avoids repeated popups if the server is briefly unavailable.
    localStorage.setItem(marker, '1');
    try {
      await api('/api/preferences/onboarding', 'PUT', { seen: true });
    } catch {
      /* the local marker still avoids repeated popups */
    }
  };
  useEffect(() => {
    if(!enabled)return;
    let alive = true;
    const timer = setTimeout(() => {
      void api('/api/preferences/onboarding')
        .then((result) => {
          if (alive && !result.seen && !localStorage.getItem(marker)) setWelcome(true);
        })
        .catch(() => {});
    }, 2200);
    return () => {
      alive = false;
      clearTimeout(timer);
      tour.current?.destroy();
    };
  }, [teacherId, marker,enabled]);
  const start = () => {
    setWelcome(false);
    void remember();
    tour.current = driver({
      animate: !matchMedia('(prefers-reduced-motion: reduce)').matches,
      showProgress: true,
      progressText: '{{current}} من {{total}}',
      nextBtnText: 'التالي',
      prevBtnText: 'السابق',
      doneBtnText: 'جاهز للبدء',
      closeBtnLabel: 'إغلاق الدليل',
      popoverClass: 'teacher-tour-popover',
      overlayColor: '#163253',
      overlayOpacity: 0.45,
      stageRadius: 14,
      disableActiveInteraction: true,
      steps: [
        {
          popover: {
            title: 'كل شيء يبدأ بثلاث خطوات',
            description:
              'أضف الطلاب، جهّز الامتحان، ثم تابع الإجابات والنتائج. يمكنك الإغلاق والعودة إلى هذا الدليل في أي وقت.',
          },
        },
        {
          element: '[data-nav="students"]',
          popover: {
            title: '١ · الطلاب ورموز الدخول',
            description:
              'أضف طالبًا أو استورد قائمة Excel. يحصل الطالب الجديد على رمز من 6 أرقام. يمكنك طباعة الرموز أو تصديرها إلى Excel.',
          },
        },
        {
          element: document.querySelector('[data-nav="simple"]')
            ? '[data-nav="simple"]'
            : '[data-nav="exams"]',
          popover: {
            title: '٢ · جهّز الامتحان',
            description:
              'في الوضع المبسط تجمع صفحة واحدة العنوان والوقت والأسئلة. اكتب الأسئلة بنفسك أو اختر من البنك، ثم راجع وانشر.',
          },
        },
        {
          element: '[data-nav="exams"]',
          popover: {
            title: 'الامتحانات ورمز الامتحان',
            description:
              'بعد النشر يظهر الامتحان للطلاب المطابقين للصف والشعبة. رمز الامتحان مختلف عن رمز دخول الطالب.',
          },
        },
        {
          element: '[data-nav="monitor"]',
          popover: {
            title: '٣ · تابع ثم شارك النتائج',
            description:
              'شاهد من بدأ ومن سلّم، واطلب الكاميرا عند الحاجة. انشر النتائج بعد المراجعة أو احفظها في Excel.',
          },
        },
        {
          element: '[data-nav="settings"]',
          popover: {
            title: 'الإعدادات والنسخ الاحتياطي',
            description:
              'هنا اتصال المدرسة ونسخ البيانات وتصدير تقارير PDF. ستجد زر «دليل البداية» دائمًا أعلى الشاشة.',
          },
        },
      ],
    });
    tour.current.drive();
  };
  return (
    <>
      <button
        className="secondary small teacher-help"
        onClick={() => setWelcome(true)}
        data-tour-help
      >
        <CircleHelp size={17} />
        دليل البداية
      </button>
      {welcome && (
        <FocusWindow
          title="مرحبًا أستاذي · لنبدأ بسهولة"
          onClose={() => {
            setWelcome(false);
            void remember();
          }}
        >
          <div className="teacher-welcome">
            <GraduationCap size={40} />
            <h2>امتحانك الأول، خطوة بخطوة</h2>
            <p>جولة قصيرة تعرّفك بالأماكن الأساسية. لن تغيّر بياناتك ولن تنشر أي امتحان.</p>
            <ol>
              <li>
                <b>أضف طلابك</b>
                <span>يدويًا أو من ملف Excel</span>
              </li>
              <li>
                <b>جهّز امتحانك</b>
                <span>أسئلة يدوية أو من البنك، دون حاجة إلى AI</span>
              </li>
              <li>
                <b>تابع النتائج</b>
                <span>ابدأ المتابعة بعد النشر وراجع العلامات</span>
              </li>
            </ol>
            <div className="button-row">
              <button className="primary" onClick={start}>
                ابدأ الجولة القصيرة
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setWelcome(false);
                  void remember();
                }}
              >
                لاحقًا، أعرف طريقي
              </button>
            </div>
          </div>
        </FocusWindow>
      )}
    </>
  );
}
