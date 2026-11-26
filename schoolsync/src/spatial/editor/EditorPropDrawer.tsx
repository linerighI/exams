/**
 * Liquid Glass Props & Prefab Studio sheet anchored at the bottom of SARE:
 * GSAP sliding category indicator, spring spin rotation, and staggered tile reveal.
 */
import { useRef, useState, type ReactNode } from 'react';
import {
  Armchair,
  BookOpen,
  Briefcase,
  DoorOpen,
  Droplets,
  Flag,
  Flower2,
  Grid2x2,
  Layers,
  Monitor,
  Presentation,
  RotateCw,
  Sofa,
  Sparkles,
  TreePine,
  Trees,
  Trophy,
  Umbrella,
  Users,
  Wind,
} from 'lucide-react';
import type { Language } from '../../i18n';
import { PROP_CATALOG } from '../engine/propLibrary';
import { gsapPop, gsapSpin, useGsapEntrance, useGsapStagger, useSlidingPill } from './editorMotion';

interface EditorPropDrawerProps {
  activePropId: string;
  propRotation: number;
  lang: Language;
  onSelectProp: (id: string) => void;
  onRotate: () => void;
}

const CATEGORIES: { key: 'furniture' | 'nature' | 'facilities'; ar: string; en: string }[] = [
  { key: 'furniture', ar: 'أثاث الصفوف', en: 'Furniture' },
  { key: 'nature', ar: 'الساحة والحدائق', en: 'Nature' },
  { key: 'facilities', ar: 'مرافق ودرج', en: 'Facilities' },
];

const PROP_ICONS: Record<string, ReactNode> = {
  desk_cluster: <Armchair size={15} />,
  teacher_desk: <Briefcase size={15} />,
  whiteboard: <Presentation size={15} />,
  lab_bench: <Monitor size={15} />,
  bookshelf: <BookOpen size={15} />,
  conference_table: <Users size={15} />,
  auditorium_stage: <Sparkles size={15} />,
  lockers: <Grid2x2 size={15} />,
  ac_unit: <Wind size={15} />,
  tree_round: <Trees size={15} />,
  tree_cypress: <TreePine size={15} />,
  planter: <Flower2 size={15} />,
  bench: <Sofa size={15} />,
  fountain: <Droplets size={15} />,
  stairs: <Layers size={15} />,
  flagpole: <Flag size={15} />,
  basketball_hoop: <Trophy size={15} />,
  pergola: <Umbrella size={15} />,
  gate: <DoorOpen size={15} />,
};

/** Bottom Liquid Glass prefab studio with sliding category pill & staggered icon tiles. */
export function EditorPropDrawer({
  activePropId,
  propRotation,
  lang,
  onSelectProp,
  onRotate,
}: EditorPropDrawerProps) {
  const [cat, setCat] = useState<'furniture' | 'nature' | 'facilities'>('furniture');
  const dockRef = useRef<HTMLDivElement>(null);
  const segTrackRef = useRef<HTMLDivElement>(null);
  const segPillRef = useRef<HTMLSpanElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLSpanElement>(null);

  const items = PROP_CATALOG.filter((p) => p.category === cat);
  const deg = Math.round(((propRotation * 180) / Math.PI) % 360);

  useGsapEntrance(
    dockRef,
    { opacity: 0, y: 20, scale: 0.96, xPercent: -50 },
    { opacity: 1, y: 0, scale: 1, xPercent: -50, duration: 0.36, ease: 'back.out(1.25)' },
    [],
  );
  useSlidingPill(segTrackRef, segPillRef, 'button.is-active', [cat, lang]);
  useGsapStagger(gridRef, '.sp-prop-tile', [cat], { y: 12, scale: 0.92, stagger: 0.022, duration: 0.28, ease: 'back.out(1.35)' });

  return (
    <div ref={dockRef} className="sp-editor-prop-dock">
      <div className="sp-prop-header">
        <div ref={segTrackRef} className="sp-seg-track sp-prop-seg" role="tablist">
          <span ref={segPillRef} className="sp-seg-pill" aria-hidden="true" />
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className={cat === c.key ? 'is-active' : ''}
              onClick={() => setCat(c.key)}
            >
              {lang === 'ar' ? c.ar : c.en}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="sp-prop-rotate-btn"
          onClick={() => {
            gsapSpin(spinRef.current);
            onRotate();
          }}
          title="R"
        >
          <span ref={spinRef} className="sp-spin-icon"><RotateCw size={13} /></span>
          <span>{deg}°</span>
        </button>
      </div>

      <div ref={gridRef} className="sp-prop-grid">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sp-prop-tile ${activePropId === item.id ? 'is-active' : ''}`}
            onClick={(e) => {
              gsapPop(e.currentTarget);
              onSelectProp(item.id);
            }}
          >
            <span className="sp-prop-icon">{PROP_ICONS[item.id] || <Armchair size={15} />}</span>
            <span>{lang === 'ar' ? item.labelAr : item.labelEn}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
