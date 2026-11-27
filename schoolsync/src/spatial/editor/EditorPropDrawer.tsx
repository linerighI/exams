/**
 * Liquid Glass Props & Shapes Studio sheet anchored at the bottom of SARE:
 * includes Custom Shapes, expanded Furniture/Nature/Facilities, and live Online 3D Library API.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Armchair, BookOpen, Box, Briefcase, Columns3, Cylinder, DoorOpen, Droplets,
  Flag, Flower2, Globe, Grid2x2, Lamp, Layers, Monitor, Presentation,
  RotateCw, Search, Sofa, Sparkles, TreePine, Trees, Trophy, Umbrella, Users, Wind,
} from 'lucide-react';
import { api } from '../../api';
import type { Language } from '../../i18n';
import { PROP_CATALOG } from '../engine/propLibrary';
import { gsapPop, gsapSpin, useGsapEntrance, useGsapStagger, useSlidingPill } from './editorMotion';

interface OnlinePropItem {
  id: string;
  name: string;
  nameAr: string;
  modelUrl: string;
  thumb?: string;
}

interface EditorPropDrawerProps {
  activePropId: string;
  activeModelUrl?: string;
  propRotation: number;
  lang: Language;
  onSelectProp: (id: string, modelUrl?: string) => void;
  onRotate: () => void;
}

type DrawerCat = 'shapes' | 'furniture' | 'nature' | 'facilities' | 'online';

const CATEGORIES: { key: DrawerCat; ar: string; en: string }[] = [
  { key: 'shapes', ar: 'أشكال', en: 'Shapes' },
  { key: 'furniture', ar: 'أثاث', en: 'Furniture' },
  { key: 'nature', ar: 'طبيعة', en: 'Nature' },
  { key: 'facilities', ar: 'مرافق', en: 'Facilities' },
  { key: 'online', ar: 'مكتبة 3D', en: '3D API' },
];

const PROP_ICONS: Record<string, ReactNode> = {
  shape_cube: <Box size={15} />, shape_pillar: <Columns3 size={15} />, shape_cylinder: <Cylinder size={15} />,
  shape_arch: <DoorOpen size={15} />, shape_slab: <Layers size={15} />, shape_cone: <Sparkles size={15} />,
  shape_dome: <Umbrella size={15} />, shape_wall_divider: <Grid2x2 size={15} />,
  desk_cluster: <Armchair size={15} />, teacher_desk: <Briefcase size={15} />, whiteboard: <Presentation size={15} />,
  lab_bench: <Monitor size={15} />, bookshelf: <BookOpen size={15} />, conference_table: <Users size={15} />,
  auditorium_stage: <Sparkles size={15} />, lockers: <Grid2x2 size={15} />, ac_unit: <Wind size={15} />,
  lamp_post: <Lamp size={15} />, tree_round: <Trees size={15} />, tree_cypress: <TreePine size={15} />,
  planter: <Flower2 size={15} />, bench: <Sofa size={15} />, fountain: <Droplets size={15} />,
  stairs: <Layers size={15} />, flagpole: <Flag size={15} />, basketball_hoop: <Trophy size={15} />,
  pergola: <Umbrella size={15} />, gate: <DoorOpen size={15} />,
};

/** Bottom Liquid Glass prefab studio with custom shapes & live 3D API search. */
export function EditorPropDrawer({
  activePropId, activeModelUrl, propRotation, lang, onSelectProp, onRotate,
}: EditorPropDrawerProps) {
  const [cat, setCat] = useState<DrawerCat>('furniture');
  const [query, setQuery] = useState('');
  const [onlineItems, setOnlineItems] = useState<OnlinePropItem[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const segTrackRef = useRef<HTMLDivElement>(null);
  const segPillRef = useRef<HTMLSpanElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLSpanElement>(null);

  const items = cat === 'online' ? [] : PROP_CATALOG.filter((p) => p.category === cat);
  const deg = Math.round(((propRotation * 180) / Math.PI) % 360);

  useEffect(() => {
    if (cat !== 'online') return;
    let alive = true;
    setLoadingOnline(true);
    const t = setTimeout(() => {
      void api<{ items: OnlinePropItem[] }>(`/props-library/search?q=${encodeURIComponent(query)}`)
        .then((res) => { if (alive) setOnlineItems(res.items || []); })
        .catch(() => { if (alive) setOnlineItems([]); })
        .finally(() => { if (alive) setLoadingOnline(false); });
    }, 180);
    return () => { alive = false; clearTimeout(t); };
  }, [cat, query]);

  useGsapEntrance(
    dockRef,
    { opacity: 0, y: 20, scale: 0.96, xPercent: -50 },
    { opacity: 1, y: 0, scale: 1, xPercent: -50, duration: 0.36, ease: 'back.out(1.25)' },
    [],
  );
  useSlidingPill(segTrackRef, segPillRef, 'button.is-active', [cat, lang]);
  useGsapStagger(gridRef, '.sp-prop-tile', [cat, onlineItems.length], { y: 10, scale: 0.93, stagger: 0.018, duration: 0.24 });

  return (
    <div ref={dockRef} className="sp-editor-prop-dock">
      <div className="sp-prop-header">
        <div ref={segTrackRef} className="sp-seg-track sp-prop-seg" role="tablist">
          <span ref={segPillRef} className="sp-seg-pill" aria-hidden="true" />
          {CATEGORIES.map((c) => (
            <button key={c.key} type="button" className={cat === c.key ? 'is-active' : ''} onClick={() => setCat(c.key)}>
              {lang === 'ar' ? c.ar : c.en}
            </button>
          ))}
        </div>
        {cat === 'online' && (
          <label className="sp-prop-search">
            <Search size={13} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'ابحث في PolyHaven 3D…' : 'Search PolyHaven 3D…'}
            />
          </label>
        )}
        <button
          type="button"
          className="sp-prop-rotate-btn"
          onClick={() => { gsapSpin(spinRef.current); onRotate(); }}
          title="R"
        >
          <span ref={spinRef} className="sp-spin-icon"><RotateCw size={13} /></span>
          <span>{deg}°</span>
        </button>
      </div>

      <div ref={gridRef} className="sp-prop-grid">
        {cat === 'online' ? (
          loadingOnline && onlineItems.length === 0 ? (
            <span className="sp-mini-hint">{lang === 'ar' ? 'جاري جلب المجسمات…' : 'Loading 3D library…'}</span>
          ) : (
            onlineItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sp-prop-tile ${activeModelUrl === item.modelUrl ? 'is-active' : ''}`}
                onClick={(e) => { gsapPop(e.currentTarget); onSelectProp(item.id, item.modelUrl); }}
              >
                {item.thumb ? (
                  <img src={item.thumb} alt={item.name} className="sp-prop-thumb" />
                ) : (
                  <span className="sp-prop-icon"><Globe size={15} /></span>
                )}
                <span>{lang === 'ar' ? item.nameAr : item.name}</span>
              </button>
            ))
          )
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sp-prop-tile ${!activeModelUrl && activePropId === item.id ? 'is-active' : ''}`}
              onClick={(e) => { gsapPop(e.currentTarget); onSelectProp(item.id, undefined); }}
            >
              <span className="sp-prop-icon">{PROP_ICONS[item.id] || <Box size={15} />}</span>
              <span>{lang === 'ar' ? item.labelAr : item.labelEn}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
