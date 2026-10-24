import StartupScreen from './StartupScreen';
import { useEffect, useState } from 'react';
import { ShieldCheck, LockKeyhole, KeyRound } from 'lucide-react';
import FocusWindow from './FocusWindow';
import { api } from './api';
import './workflow.css';
import ServicesPanel from './ServicesPanel';
import {layers} from './serviceCatalog';
export function ZunisSplash() {
 const [elapsed]=useState(()=>{const start=Number(sessionStorage.getItem('zunis-started-at'));return start>0?Math.max(0,(Date.now()-start)/1000):0});
 const [visible,setVisible]=useState(()=>!sessionStorage.getItem('zunis-welcome')&&elapsed<3.85);
 const close=()=>{try{sessionStorage.setItem('zunis-welcome','1')}catch{}setVisible(false)};
 return visible?<StartupScreen elapsed={elapsed} onDone={close}/>:null;
}
export function ZunisBrand() {
  const [servicesOpen,setServicesOpen]=useState(false);
  const [open, setOpen] = useState(false),
    [status, setStatus] = useState<any>(),
    [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let live = true;
    setStatus(undefined);
    setError('');
    void api('/api/security/status')
      .then((v) => {
        if (live) setStatus(v);
      })
      .catch(() => {
        if (live) setError('تعذر الاتصال بخادم المدرسة للتحقق من الحالة.');
      });
    return () => {
      live = false;
    };
  }, [open]);
  return (
    <>
      <span className="service-footer-group"><button className="zunis-brand" onClick={() => setOpen(true)}>
        <ShieldCheck size={13} />
        Powered by Zunis 1
      </button>{layers.slice(1).map(layer=><button key={layer.id} className="service-footer-layer" onClick={()=>setServicesOpen(true)}><span dir="ltr">{layer.name} {layer.version}</span></button>)}</span>
      {servicesOpen&&<FocusWindow title="خدمات المدرسة" onClose={()=>setServicesOpen(false)} wide><ServicesPanel tools={false}/></FocusWindow>}
      {open && (
        <FocusWindow title="Zunis · حالة الحماية" onClose={() => setOpen(false)}>
          <div className="zunis-details">
            <ShieldCheck size={36} />
            <h3>حماية مبنية داخل التطبيق</h3>
            <p>تُطبق الصلاحيات في الخادم، وتبقى قوائم الطلاب خارج سياق الذكاء الاصطناعي.</p>
            {status ? (
              <>
                <ul>
                  <li>
                    <LockKeyhole size={17} /> اتصال المدرسة:{' '}
                    {status.transport === 'https'
                      ? 'HTTPS'
                      : 'HTTP محلي للتطوير — استخدم تطبيق Windows للاتصال المشفر'}
                  </li>
                  <li>
                    <KeyRound size={17} /> كلمات المرور: {status.passwordHashing}
                  </li>
                  <li>إجراءات المعلم: تحقق من صلاحية الحساب في الخادم</li>
                  <li>خروج الطالب: كلمة مرور المعلم مطلوبة</li>
                </ul>
                <small>آخر قراءة: {new Date(status.checkedAt).toLocaleTimeString('ar-JO')}</small>
              </>
            ) : (
              <p role="status">{error || 'جارٍ قراءة حالة الخادم…'}</p>
            )}
            <p className="zunis-note">
              Zunis اسم طبقة الحماية في هذا التطبيق، وليس شهادة تدقيق خارجي أو ضمانًا مطلقًا.
            </p>
          </div>
        </FocusWindow>
      )}
    </>
  );
}
