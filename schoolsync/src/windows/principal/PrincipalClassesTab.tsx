/**
 * Principal Office -> Classes & 3D Rooms tab: clear class creation card,
 * explicit Class Lead Teacher (`مربي الصف`) assignment, student counts, and 3D slot search.
 */
import { useMemo, useState, type FormEvent } from 'react';
import { Compass, Layers, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import type { Language } from '../../i18n';
import { resolveClassLeadTeacher } from '../../spatial/leadTeacher';
import type { ResolvedSpatialRoom } from '../../spatial/roomCatalog';
import type { State } from '../../types';
import { GlassSelect } from '../GlassSelect';

interface PrincipalClassesTabProps {
  rooms: ResolvedSpatialRoom[];
  data: State;
  lang: Language;
  busy: boolean;
  onFlyToRoom: (room: ResolvedSpatialRoom) => void;
  onEditRoom: (room: ResolvedSpatialRoom) => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Classes directory with lead-teacher assignment plus searchable 3D campus room list. */
export function PrincipalClassesTab({
  rooms,
  data,
  lang,
  busy,
  onFlyToRoom,
  onEditRoom,
  mutate,
}: PrincipalClassesTabProps) {
  const ar = lang === 'ar';
  const [view, setView] = useState<'classes' | 'spatial'>('classes');
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ name: '', gradeLevel: '', leadTeacherId: '' });

  const studentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of data.students) counts.set(s.section, (counts.get(s.section) || 0) + 1);
    return counts;
  }, [data.students]);

  const filteredClasses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.classes.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || (c.grade_level || '').toLowerCase().includes(q),
    );
  }, [data.classes, query]);

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms.filter(
      (r) =>
        !q ||
        r.label.toLowerCase().includes(q) ||
        r.className.toLowerCase().includes(q) ||
        r.slotId.toLowerCase().includes(q),
    );
  }, [rooms, query]);

  const teacherOptions = useMemo(
    () => [
      { value: '', label: ar ? '— بدون مربي محدد —' : '— Unassigned —' },
      ...data.teachers.map((t) => ({ value: t.id, label: t.name })),
    ],
    [ar, data.teachers],
  );

  const handleAddClass = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const ok = await mutate(
      '/classes',
      {
        name: form.name.trim(),
        gradeLevel: form.gradeLevel.trim(),
        room: form.name.trim(),
        leadTeacherId: form.leadTeacherId || null,
      },
      ar ? 'تمت إضافة الشعبة بنجاح' : 'Class created',
    );
    if (ok) {
      setForm({ name: '', gradeLevel: '', leadTeacherId: '' });
      setShowCreate(false);
    }
  };

  return (
    <div className="sp-tab-pane">
      <div className="sp-toolbar-row">
        <div className="sp-po-subswitch">
          <button type="button" className={view === 'classes' ? 'is-active' : ''} onClick={() => setView('classes')}>
            {ar ? `الشعب الدراسية (${data.classes.length})` : `Classes (${data.classes.length})`}
          </button>
          <button type="button" className={view === 'spatial' ? 'is-active' : ''} onClick={() => setView('spatial')}>
            <Layers size={12} style={{ marginInlineEnd: 4 }} />
            {ar ? `غرف المجسم (${rooms.length})` : `3D Rooms (${rooms.length})`}
          </button>
        </div>

        {view === 'classes' && (
          <button type="button" className="sp-btn-primary" onClick={() => setShowCreate((v) => !v)}>
            <Plus size={14} />
            <span>{showCreate ? (ar ? 'إغلاق' : 'Close') : (ar ? 'شعبة جديدة' : 'New Class')}</span>
          </button>
        )}
      </div>

      {showCreate && view === 'classes' && (
        <form className="sp-inline-box" onSubmit={(e) => void handleAddClass(e)}>
          <div className="sp-po-card-head">
            <strong>{ar ? 'إضافة شعبة دراسية جديدة' : 'Create New Class Section'}</strong>
          </div>
          <label className="sp-field">
            <span>{ar ? 'اسم الشعبة' : 'Section Name'}</span>
            <input
              required
              placeholder={ar ? 'مثال: العاشر هـ' : 'e.g. Grade 10E'}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <div className="sp-row-2">
            <label className="sp-field">
              <span>{ar ? 'المرحلة الدراسية' : 'Grade Level'}</span>
              <input
                placeholder={ar ? 'مثال: الصف العاشر' : 'e.g. Grade 10'}
                value={form.gradeLevel}
                onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
              />
            </label>
            <div className="sp-field">
              <span>{ar ? 'مربي الصف (اختياري)' : 'Class Lead Teacher'}</span>
              <GlassSelect
                ariaLabel={ar ? 'مربي الصف' : 'Class Lead Teacher'}
                value={form.leadTeacherId}
                options={teacherOptions}
                onChange={(val) => setForm({ ...form, leadTeacherId: val })}
              />
            </div>
          </div>
          <button type="submit" className="sp-btn-primary" disabled={busy}>
            <Plus size={14} />
            <span>{ar ? 'حفظ وإضافة الشعبة' : 'Save Class'}</span>
          </button>
        </form>
      )}

      <div className="sp-search-mini">
        <Search size={14} />
        <input
          placeholder={
            view === 'classes'
              ? ar ? 'ابحث في الشعب أو المراحل…' : 'Search classes…'
              : ar ? 'ابحث عن قاعة على المجسم…' : 'Search 3D rooms…'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {view === 'classes' ? (
        <div className="sp-list-stack">
          {filteredClasses.length === 0 ? (
            <p className="sp-empty-note">{ar ? 'لا توجد شعب مطابقة' : 'No matching classes'}</p>
          ) : (
            filteredClasses.map((c) => {
              const lead = resolveClassLeadTeacher(data, c.name);
              const mappedRoom = rooms.find((r) => r.className === c.name);
              const count = studentCounts.get(c.name) || 0;
              return (
                <div key={c.id} className="sp-info-row">
                  <div>
                    <strong>{c.name}</strong>
                    <small>
                      <Users size={11} style={{ verticalAlign: -1, marginInlineEnd: 4 }} />
                      {count} {ar ? 'طالب' : 'students'}
                      {c.grade_level ? ` · ${c.grade_level}` : ''}
                    </small>
                  </div>

                  <div className="sp-po-lead-row">
                    <div className="sp-po-lead-picker">
                      <GlassSelect
                        ariaLabel={ar ? `مربي صف ${c.name}` : `Lead teacher for ${c.name}`}
                        value={lead?.id || ''}
                        options={teacherOptions}
                        onChange={(val) =>
                          void mutate(
                            `/classes/${c.id}/lead-teacher`,
                            { teacherId: val || null },
                            ar ? `تم تحديث مربي صف ${c.name}` : 'Lead teacher updated',
                          )
                        }
                      />
                    </div>
                    {mappedRoom && (
                      <button
                        type="button"
                        className="sp-icon-btn"
                        title={ar ? 'انتقال إلى القاعة ثلاثية الأبعاد' : 'Fly to 3D room'}
                        onClick={() => onFlyToRoom(mappedRoom)}
                      >
                        <Compass size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="sp-icon-btn is-danger"
                      title={ar ? 'حذف الشعبة' : 'Delete class'}
                      onClick={() => void mutate(`/classes/${c.id}/delete`, {}, ar ? 'تم حذف الشعبة' : 'Deleted')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="sp-list-stack">
          {filteredRooms.map((r) => (
            <div key={r.slotId} className="sp-info-row">
              <div>
                <strong>{r.label}</strong>
                <small>
                  {r.className || (ar ? `طابق ${r.floor}` : `Floor ${r.floor}`)} · {r.kind}
                </small>
              </div>
              <div className="sp-row-actions">
                <button type="button" className="sp-icon-btn" onClick={() => onFlyToRoom(r)} title={ar ? 'انتقال' : 'Fly'}>
                  <Compass size={14} />
                </button>
                <button type="button" className="sp-icon-btn" onClick={() => onEditRoom(r)} title={ar ? 'تعديل المسمى' : 'Rename'}>
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
