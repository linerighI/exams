import { useRef, useState } from 'react';
import { ShieldCheck, Sparkles, Network, BookOpen, ArrowUpLeft, Shapes } from 'lucide-react';
import { layers, subjectServices, type SubjectService } from './serviceCatalog';
import { useAnimato } from './animato';
import MathDiagramEditor from './MathDiagramEditor';
import './services.css';
export default function ServicesPanel({ tools = true }: { tools?: boolean }) {
  const root = useRef<HTMLDivElement>(null),
    [selected, setSelected] = useState<SubjectService>('math'),
    [drawing, setDrawing] = useState(false),
    [image, setImage] = useState('');
  useAnimato(root, selected);
  const active = subjectServices.find((s) => s.id === selected)!;
  return (
    <div className="services-panel" ref={root}>
      <header className="services-heading" data-animato>
        <span className="services-eyebrow">مساحة واحدة. خدمات متخصصة.</span>
        <h2>خدمات المدرسة</h2>
        <p>
          طبقات التطبيق لها إصدارات مستقلة. وخدمات المواد تضبط اللغة والمعادلات ومراجعة الأسئلة.
        </p>
      </header>
      <div className="service-layers">
        {layers.map((layer, i) => {
          const Icon = [ShieldCheck, Sparkles, Network][i];
          return (
            <article key={layer.id} data-animato>
              <Icon size={23} />
              <span>{layer.label}</span>
              <h3 dir="ltr">
                {layer.name} <small>{layer.version}</small>
              </h3>
              <p>{layer.detail}</p>
            </article>
          );
        })}
      </div>
      <div className="service-subject-nav" role="tablist" aria-label="خدمات المواد">
        {subjectServices.map((s) => (
          <button
            role="tab"
            aria-selected={selected === s.id}
            key={s.id}
            onClick={() => setSelected(s.id)}
          >
            <BookOpen size={17} />
            {s.name}
            <small>V{s.version}</small>
          </button>
        ))}
      </div>
      <section className="service-subject" role="tabpanel" aria-label={active.name} data-animato>
        <span className="services-eyebrow">{active.scope}</span>
        <h3>
          {active.name} <small>1</small>
        </h3>
        <p>{active.description}</p>
        {selected === 'math' ? (
          <>
            <div className="service-math-path">
              <div>
                <b>01</b>
                <strong>صياغة دقيقة</strong>
                <p>طلب متخصص للمعادلات والوحدات والافتراضات، مع رسوم عند اختيار المعلم لها.</p>
              </div>
              <div>
                <b>02</b>
                <strong>فحص قبل الاعتماد</strong>
                <p>
                  كشف المعادلات التي لا تُعرض والخيارات العددية المتكافئة والصورة المطلوبة المفقودة.
                </p>
              </div>
              <div>
                <b>03</b>
                <strong>رسم من المعطيات</strong>
                <p>منحنيات ومثلثات وقوى تُرسم محليًا من القيم التي تحددها.</p>
              </div>
            </div>
            {tools && (
              <button className="primary" onClick={() => setDrawing(true)}>
                <Shapes size={18} />
                افتح مساحة الرسم
                <ArrowUpLeft size={16} />
              </button>
            )}
            <p className="service-review-note">
              الفحص محدود بالعرض والخيارات؛ يراجع المعلم صحة الحل والوحدات ومعنى الرسم قبل النشر.
            </p>
            {image && (
              <div className="service-export">
                <img src={image} alt="الرسم الجاهز للإرفاق" />
                <a className="secondary" href={image} download="math-service-diagram.png">
                  حفظ الرسم PNG
                </a>
                <small>يمكنك إرفاقه بسؤال من البنك أو الامتحان.</small>
              </div>
            )}
          </>
        ) : (
          <p>
            تُستخدم قواعد هذه الخدمة في طلبات توليد البنك بحسب مادة الكتاب، مع الإبقاء على مراجعة
            المعلم وأنواع الأسئلة الحالية.
          </p>
        )}
      </section>
      {tools && drawing && (
        <MathDiagramEditor onClose={() => setDrawing(false)} onSave={setImage} />
      )}
    </div>
  );
}
