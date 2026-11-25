/**
 * Auditorium floating window: publish school-wide announcements and manage the noticeboard.
 */
import { useState, type FormEvent } from 'react';
import { Megaphone, Send } from 'lucide-react';
import type { Language } from '../i18n';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import { isManagerRole, type State } from '../types';
import { FloatingWindow } from './FloatingWindow';

interface AuditoriumWindowProps {
  room: ResolvedSpatialRoom;
  data: State;
  lang: Language;
  busy: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Auditorium & School Noticeboard floating window. */
export function AuditoriumWindow({
  room,
  data,
  lang,
  busy,
  zIndex,
  onFocus,
  onClose,
  mutate,
}: AuditoriumWindowProps) {
  const manager = isManagerRole(data.user.role);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handlePublish = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await mutate(
      '/announcements',
      { title: title.trim(), content: content.trim() },
      lang === 'ar' ? 'تم نشر الإعلان لجميع المدرسة' : 'Announcement broadcast',
    );
    if (ok) {
      setTitle('');
      setContent('');
    }
  };

  return (
    <FloatingWindow
      id={`room-${room.slotId}`}
      title={room.label}
      subtitle={lang === 'ar' ? 'بث الإعلانات والتعميمات المدرسية' : 'School Noticeboard Broadcast'}
      dock="right"
      width={440}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
    >
      <div className="sp-tab-pane">
        {manager && (
          <form className="sp-inline-box" onSubmit={(e) => void handlePublish(e)}>
            <label className="sp-field">
              <span>{lang === 'ar' ? 'عنوان الإعلان' : 'Announcement Title'}</span>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="sp-field">
              <span>{lang === 'ar' ? 'نص التعميم' : 'Message'}</span>
              <textarea rows={3} required value={content} onChange={(e) => setContent(e.target.value)} />
            </label>
            <button type="submit" className="sp-btn-primary" disabled={busy}>
              <Send size={14} />
              <span>{lang === 'ar' ? 'نشر للجميع' : 'Broadcast'}</span>
            </button>
          </form>
        )}

        <h4 className="sp-subhead">{lang === 'ar' ? 'أحدث الإعلانات' : 'Recent Announcements'}</h4>
        <div className="sp-list-stack">
          {data.announcements.length === 0 ? (
            <p className="sp-empty-note">{lang === 'ar' ? 'لا توجد إعلانات منشورة' : 'No announcements yet'}</p>
          ) : (
            data.announcements.map((a) => (
              <div key={a.id} className="sp-note-card">
                <div className="sp-note-head">
                  <Megaphone size={14} className="is-blue" />
                  <strong>{a.title}</strong>
                  <small>{a.created.slice(0, 10)}</small>
                </div>
                <p>{a.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </FloatingWindow>
  );
}
