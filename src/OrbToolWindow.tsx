import { useState, type RefObject } from 'react';
import { X, GripHorizontal, Minus, Expand, Minimize2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import useOrbWindowMotion from './useOrbWindowMotion';
import {
  BlueprintTool,
  EquationWorkshop,
  QuestionWorkshop,
  RubricTool,
  StatisticsTool,
  TeacherCalculator,
  TeacherDrawing,
  UnitConverter,
} from './TeacherToolPanels';
import { orbTools } from './WorkflowGuide';
import type { Exam } from './types';
import './teacherTools.css';
import './orbTools.css';

export default function OrbToolWindow({
  tool,
  teacherId,
  onClose,
  onMinimize,
  openExam,
  minimized,
  dockRef,
}: {
  tool: string;
  teacherId: string;
  onClose: () => void;
  onMinimize: () => void;
  openExam: (exam: Exam) => void;
  minimized: boolean;
  dockRef: RefObject<HTMLElement | null>;
}) {
  const windowMotion = useOrbWindowMotion<HTMLElement>(!minimized, dockRef);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();
  const [position, setPosition] = useState({ x: Math.max(12, innerWidth - 560), y: 90 });
  const [message, notify] = useState(''),
    [image, setImage] = useState(''),
    [transfer, setTransfer] = useState<{ id: string; text: string }>();
  let preferences: any = {};
  try {
    preferences = JSON.parse(
      localStorage.getItem(`teacher-tools-preferences:${teacherId}`) || '{}',
    );
  } catch {}
  const context = {
    grade: preferences.grade || 'العاشر',
    subject: preferences.subject || 'الرياضيات',
    term: preferences.term || 'الأول',
    teacherId,
    notify,
    openExam,
  };
  return (
    <motion.aside
      ref={windowMotion.ref}
      layout={!dragging}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34 }}
      className={`orb-tool-window ${tool === 'geometry' || tool === 'writer' ? 'is-large' : ''}`}
      role="dialog"
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        windowMotion.minimize(onMinimize);
      }}
      aria-label={orbTools.find((t) => t.id === tool)?.title}
      style={{
        width: expanded ? 'calc(100vw - 32px)' : undefined,
        height: expanded ? 'calc(100dvh - 32px)' : undefined,
        maxHeight: expanded ? 'calc(100dvh - 32px)' : undefined,
        resize: expanded ? 'none' : undefined,
        left: expanded
          ? 16
          : Math.min(
              position.x,
              Math.max(
                12,
                innerWidth - (tool === 'geometry' || tool === 'writer' ? 760 : 510) - 16,
              ),
            ),
        top: expanded ? 16 : Math.min(position.y, Math.max(12, innerHeight - 180)),
      }}
    >
      <header
        onPointerDown={(e) => {
          if (expanded || (e.target as HTMLElement).closest('button') || e.button !== 0) return;
          const start = position;
          setDragging(true);
          const originX = e.clientX,
            originY = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
          const target = e.currentTarget;
          const move = (event: PointerEvent) =>
            setPosition({
              x: Math.max(12, Math.min(innerWidth - 160, start.x + event.clientX - originX)),
              y: Math.max(12, Math.min(innerHeight - 100, start.y + event.clientY - originY)),
            });
          const end = () => {
            setDragging(false);
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', end);
            target.removeEventListener('pointercancel', end);
          };
          target.addEventListener('pointermove', move);
          target.addEventListener('pointerup', end);
          target.addEventListener('pointercancel', end);
        }}
      >
        <strong>
          <GripHorizontal size={16} />
          {orbTools.find((t) => t.id === tool)?.title}
        </strong>
        <span>
          <button
            aria-label={expanded ? 'استعادة حجم الأداة' : 'تكبير الأداة'}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <Minimize2 size={16} /> : <Expand size={16} />}
          </button>
          <button aria-label="تصغير الأداة" onClick={() => windowMotion.minimize(onMinimize)}>
            <Minus size={17} />
          </button>
          <button aria-label="إغلاق الأداة" onClick={() => windowMotion.minimize(onClose)}>
            <X size={18} />
          </button>
        </span>
      </header>
      <div className="orb-tool-body">
        {tool === 'calculator' && <TeacherCalculator />}
        {tool === 'geometry' && (
          <TeacherDrawing
            notify={notify}
            insert={(v) => {
              setImage(v);
              notify('الرسم جاهز في مختبر كتابة الأسئلة داخل الكرة');
            }}
          />
        )}
        {tool === 'equations' && (
          <EquationWorkshop
            notify={notify}
            insert={(text) => {
              setTransfer({ id: crypto.randomUUID(), text });
              notify('النص جاهز في مختبر كتابة الأسئلة داخل الكرة');
            }}
          />
        )}
        {tool === 'units' && <UnitConverter />}
        {tool === 'statistics' && <StatisticsTool notify={notify} />}
        {tool === 'blueprint' && <BlueprintTool context={context} />}
        {tool === 'rubric' && <RubricTool notify={notify} />}
        {tool === 'writer' && (
          <QuestionWorkshop
            context={context}
            image={image}
            clearImage={() => setImage('')}
            transfer={transfer}
            consumeTransfer={() => setTransfer(undefined)}
          />
        )}
        {message && (
          <p role="status" className="orb-tool-message">
            {message}
          </p>
        )}
      </div>
    </motion.aside>
  );
}
