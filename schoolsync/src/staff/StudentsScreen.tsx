/**
 * Staff `Students` (`الطلاب`) screen with search, section filters, instant
 * 1-tap attendance toggles (immediately notifying parents on absence), and
 * tap-through into Student Profile.
 */
import { useMemo, useRef, useState } from 'react';
import { Check, Eye, Phone, Search, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { pulseToggle } from '../animation';
import { StudentAvatar } from '../components/StudentAvatar';
import type { Language } from '../i18n';
import { WinButton, WinCommandBar, animateSuccessFlash, useStaggerGrid } from '../schoolsync-ui';
import type { State, Student } from '../types';
import { Empty } from '../ui';
import { StudentsFilterDrawer } from './StudentsFilterDrawer';

export function StudentsScreen({
  data,
  lang,
  initialSection = 'all',
  mutate,
  busy: _busy,
  onOpenProfile,
  onPreview,
}: {
  data: State;
  lang: Language;
  initialSection?: string;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
  busy: boolean;
  onOpenProfile: (studentId: string) => void;
  onPreview: (studentId: string) => void;
}) {
  const ar = lang === 'ar';
  const [query, setQuery] = useState('');
  const [section, setSection] = useState(initialSection);
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const togglingRef = useRef<string>('');
  const gridRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => {
    const names = new Set<string>();
    for (const c of data.classes) names.add(c.name);
    for (const s of data.students) if (s.section) names.add(s.section);
    return [...names];
  }, [data.classes, data.students]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.students.filter((s) => {
      if (section !== 'all' && s.section !== section) return false;
      const isAbsent = s.today_status === 'absent';
      if (statusFilter === 'absent' && !isAbsent) return false;
      if (statusFilter === 'present' && isAbsent) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.section.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.students, query, section, statusFilter]);

  const activeFiltersCount = (section !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);
  useStaggerGrid(gridRef, '.student-roster-card', [section, statusFilter, query, filtered.length]);

  const toggleAttendance = async (e: React.MouseEvent<HTMLButtonElement>, s: Student) => {
    e.stopPropagation();
    pulseToggle(e.currentTarget);
    animateSuccessFlash(e.currentTarget.closest<HTMLElement>('.student-roster-card'));
    const nextStatus = s.today_status === 'absent' ? 'present' : 'absent';
    togglingRef.current = s.id;
    await mutate(
      '/attendance/quick',
      { studentId: s.id, status: nextStatus },
      nextStatus === 'absent'
        ? ar
          ? `تم تسجيل غياب ${s.name.split(' ')[0]} وإشعار ولي الأمر فوراً`
          : `Marked ${s.name.split(' ')[0]} absent & notified parent`
        : ar
          ? `تم تسجيل حضور ${s.name.split(' ')[0]}`
          : `Marked ${s.name.split(' ')[0]} present`,
    );
    togglingRef.current = '';
  };

  return (
    <div className="students-screen">
      <div className="page-intro" data-reveal>
        <div className="eyebrow">{ar ? 'إدارة الحضور وملفات الطلاب' : 'ROSTER & INSTANT ROLL CALL'}</div>
        <h1>
          {ar ? 'الطلاب' : 'Students'}
          <span className="greeting-dot">.</span>
        </h1>
        <p>
          {ar
            ? 'اضغط على زر التبديل لتسجيل الغياب أو الحضور فوراً، أو اضغط على البطاقة لفتح ملف الطالب.'
            : 'Tap the switch to toggle absence instantly, or tap a student card to open their profile.'}
        </p>
      </div>

      <div className="students-toolbar" data-reveal>
        <label className="search-field">
          <Search size={17} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ar ? 'ابحث باسم الطالب...' : 'Search by name...'}
            aria-label={ar ? 'ابحث باسم الطالب' : 'Search student'}
          />
        </label>
        <WinCommandBar
          title={section === 'all' ? (ar ? `كل الشعب (${filtered.length})` : `All Classes (${filtered.length})`) : `${section} (${filtered.length})`}
          subtitle={
            statusFilter === 'absent'
              ? ar ? 'عرض الغائبين فقط' : 'Absent students only'
              : statusFilter === 'present'
                ? ar ? 'عرض الحاضرين فقط' : 'Present students only'
                : ar ? `${data.students.filter((s) => s.today_status === 'absent').length} غائب اليوم` : `${data.students.filter((s) => s.today_status === 'absent').length} absent today`
          }
          actions={
            <>
              {activeFiltersCount > 0 && (
                <WinButton
                  variant="subtle"
                  onClick={() => {
                    setSection('all');
                    setStatusFilter('all');
                  }}
                >
                  {ar ? 'إعادة ضبط' : 'Reset'}
                </WinButton>
              )}
              <WinButton variant="standard" badge={activeFiltersCount} onClick={() => setDrawerOpen(true)}>
                <SlidersHorizontal size={15} />
                {ar ? 'تصفية القائمة' : 'Filter'}
              </WinButton>
            </>
          }
        />
      </div>

      <StudentsFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lang={lang}
        totalCount={data.students.length}
        filteredCount={filtered.length}
        sections={sections}
        section={section}
        onSelectSection={setSection}
        statusFilter={statusFilter}
        onSelectStatus={setStatusFilter}
      />

      {filtered.length ? (
        <div ref={gridRef} className="student-cards-grid" data-reveal>
          {filtered.map((s) => {
            const isAbsent = s.today_status === 'absent';
            const isPresent = !isAbsent;
            return (
              <article
                className={`student-roster-card t-surface ${isAbsent ? 'is-absent' : ''}`}
                key={s.id}
                onClick={() => onOpenProfile(s.id)}
              >
                <div className="student-card-top">
                  <div className="student-card-identity">
                    <StudentAvatar name={s.name} initialsText={s.initials} color={s.color} />
                    <div>
                      <h3>{s.name}</h3>
                      <small>
                        <span className={`dot-indicator ${isAbsent ? 'red' : s.today_status === 'present' ? 'green' : 'muted'}`} />
                        {s.section}
                        {isAbsent
                          ? ar
                            ? ' · غائب اليوم'
                            : ' · Absent'
                          : s.today_status === 'present'
                            ? ar
                              ? ' · حاضر'
                              : ' · Present'
                            : ''}
                      </small>
                    </div>
                  </div>
                  <span onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isPresent}
                      aria-label={ar ? `تبديل حضور ${s.name}` : `Toggle attendance for ${s.name}`}
                      className={`att-toggle ${isPresent ? 'on' : 'off'}`}
                      onClick={(e) => void toggleAttendance(e, s)}
                    >
                      <span className="att-knob">{isPresent ? <Check size={14} /> : <X size={14} />}</span>
                    </button>
                  </span>
                </div>

                <div className="student-card-foot">
                  <div className="card-quick-icons" onClick={(e) => e.stopPropagation()}>
                    {s.guardian_phone ? (
                      <a
                        className="mini-icon-btn"
                        href={`tel:${s.guardian_phone}`}
                        aria-label={ar ? `اتصال بولي أمر ${s.name}` : `Call guardian of ${s.name}`}
                      >
                        <Phone size={15} />
                      </a>
                    ) : (
                      <span className="mini-icon-btn muted" title={ar ? 'لا يوجد رقم مسجل' : 'No phone'}>
                        <Phone size={15} />
                      </span>
                    )}
                    <button
                      type="button"
                      className="mini-icon-btn"
                      aria-label={ar ? `معاينة ولي أمر ${s.name}` : `Preview guardian view for ${s.name}`}
                      onClick={() => onPreview(s.id)}
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      className="mini-icon-btn"
                      aria-label={ar ? `ملف ${s.name}` : `Profile of ${s.name}`}
                      onClick={() => onOpenProfile(s.id)}
                    >
                      <UserRound size={15} />
                    </button>
                  </div>
                  <span className="last-absence-label">
                    {ar ? 'آخر غياب: ' : 'Last absence: '}
                    <strong>{s.last_absence || (ar ? 'لا يوجد' : 'N/A')}</strong>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title={ar ? 'لا يوجد طلاب مطابقون' : 'No matching students'}
          detail={
            data.students.length
              ? ar
                ? 'جرّب تغيير كلمة البحث أو اختيار شعبة أخرى.'
                : 'Try adjusting your search or section filter.'
              : ar
                ? 'تضيف الإدارة الطلاب أولاً من شاشة الإدارة.'
                : 'School administration can enroll students first.'
          }
        />
      )}
    </div>
  );
}
