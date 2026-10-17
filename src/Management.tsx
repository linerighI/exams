import { useEffect, useState } from 'react';
import {
  Plus,
  Upload,
  Download,
  Search,
  Copy,
  School,
  Sparkles,
  Wifi,
  Monitor,
  ShieldCheck,
  Activity,
  Loader2,
} from 'lucide-react';
import { api, download } from './api';
import { csvCell } from './csv';
import TeacherAccounts from './TeacherAccounts';
import StudentRosterImport from './StudentRosterImport';
import type { Student, Exam, Settings as Config } from './types';
export function StudentsView({
  students,
  exams,
  notify,
  act,
  onStudentLogin,
}: {
  students: Student[];
  exams: Exam[];
  notify: (m: string) => void;
  act: (fn: () => Promise<any>, m?: string) => Promise<void>;
  onStudentLogin: (student: Student) => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [classFilter, setClassFilter] = useState('');
  const classGroups = new Map<
    string,
    { key: string; grade: string; section: string; count: number }
  >();
  for (const student of students) {
    const key = JSON.stringify([student.grade, student.section]);
    const group = classGroups.get(key);
    if (group) group.count++;
    else classGroups.set(key, { key, grade: student.grade, section: student.section, count: 1 });
  }
  const classes = [...classGroups.values()].sort(
    (a, b) =>
      a.grade.localeCompare(b.grade, 'ar', { numeric: true }) ||
      a.section.localeCompare(b.section, 'ar'),
  );
  const [form, setForm] = useState({ id: '', name: '', grade: '', section: '' });
  const [query, setQuery] = useState('');
  const [exemptExam, setExemptExam] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [enteringStudent, setEnteringStudent] = useState(false);
  const visibleStudents = students.filter(
    (s) =>
      (!classFilter || JSON.stringify([s.grade, s.section]) === classFilter) &&
      `${s.name} ${s.id} ${s.grade} ${s.section}`.includes(query),
  );
  const escape = csvCell;
  const csv =
    '\ufeff' +
    [
      ['رقم الطالب', 'الاسم', 'الصف', 'الشعبة', 'رمز الدخول'],
      ...students.map((s) => [
        s.id,
        s.name,
        s.grade,
        s.section,
        s.loginMethod === 'national' ? 'الرقم الوطني المسجل' : s.code,
      ]),
    ]
      .map((r) => r.map(escape).join(','))
      .join('\r\n');
  return (
    <>
      {importOpen && (
        <StudentRosterImport
          onClose={() => setImportOpen(false)}
          onImported={async () => {
            await act(async () => {});
          }}
        />
      )}
      <div className="page-title">
        <div>
          <h1>الطلاب والصفوف</h1>
          <p>
            {students.length} طالب · {classes.length} صف وشعبة
          </p>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={() => setImportOpen(true)}>
            <Upload size={17} /> استيراد Excel أو CSV
          </button>
          <button className="primary" onClick={() => setShow(!show)}>
            <Plus size={17} /> إضافة طالب
          </button>
        </div>
      </div>
      {show && (
        <form
          className="card student-form"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await api('/api/students', 'POST', form);
              setForm({ id: '', name: '', grade: '', section: '' });
              setShow(false);
            }, 'تمت إضافة الطالب');
          }}
        >
          {[
            ['id', 'رقم الطالب'],
            ['name', 'اسم الطالب'],
            ['grade', 'الصف'],
            ['section', 'الشعبة'],
          ].map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <input
                required
                value={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <button className="primary">حفظ الطالب</button>
        </form>
      )}
      {students.length > 0 && (
        <details className="teacher-disclosure">
          <summary>
            <Monitor size={16} /> تجربة حساب طالب
          </summary>
          <div className="toolbar card">
            <label className="field" style={{ flex: 1, margin: 0 }}>
              اختيار طالب لتجربة الدخول
              <select
                aria-label="اختيار طالب لتجربة الدخول"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
              >
                <option value="">اختر الطالب…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.id} · الصف {s.grade} / {s.section}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              disabled={!selectedStudent || enteringStudent}
              onClick={() => {
                const student = students.find((s) => s.id === selectedStudent);
                if (student) {
                  setEnteringStudent(true);
                  void onStudentLogin(student)
                    .catch((e) => notify(e.message))
                    .finally(() => setEnteringStudent(false));
                }
              }}
            >
              {enteringStudent ? <Loader2 className="spin" size={17} /> : <Monitor size={17} />}دخول
              بصفة الطالب
            </button>
          </div>
        </details>
      )}
      <nav className="class-folders" aria-label="الصفوف والشعب">
        <button aria-pressed={!classFilter} onClick={() => setClassFilter('')}>
          <School size={22} />
          <strong>كل الطلاب</strong>
          <span>{students.length} طالب</span>
        </button>
        {classes.map((group) => (
          <button
            key={group.key}
            aria-pressed={classFilter === group.key}
            onClick={() => setClassFilter(group.key)}
          >
            <School size={22} />
            <strong>
              الصف {group.grade} · {group.section}
            </strong>
            <span>{group.count} طالب</span>
          </button>
        ))}
      </nav>
      <div className="toolbar card">
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="البحث في الطلاب"
            placeholder="ابحث بالاسم أو الرقم…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className="secondary"
          onClick={() =>
            window.desktop ? void window.desktop.exportCSV(csv) : download('students.csv', csv)
          }
        >
          <Download size={17} /> تصدير الرموز
        </button>
        <button
          className="text-button"
          onClick={() =>
            download(
              'students-template.csv',
              '\ufeffرقم الطالب,اسم الطالب,الرقم الوطني,الصف,الشعبة\r\n1001,طالب تجريبي,1234567890,السابع,أ',
            )
          }
        >
          نموذج الاستيراد
        </button>
      </div>

      {students.length ? (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الصف</th>
                <th>الشعبة</th>
                <th>رمز الدخول</th>
                <th>استثناء الكاميرا</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="table-person">
                      <span className="avatar small">{s.name[0]}</span>
                      <div>
                        <strong>{s.name}</strong>
                        <small>{s.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>{s.grade}</td>
                  <td>{s.section}</td>
                  <td>
                    <span className="student-code" dir="ltr">
                      {s.loginMethod === 'national' ? 'الرقم الوطني المسجل' : s.code}
                    </span>
                    {s.loginMethod !== 'national' && (
                      <button
                        className="copy-button"
                        title="نسخ رمز الطالب"
                        onClick={() => {
                          void navigator.clipboard.writeText(s.code);
                          notify('تم نسخ الرمز');
                        }}
                      >
                        <Copy size={15} />
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        if (!exemptExam) return notify('اختر الامتحان من القائمة أدناه');
                        void act(
                          () =>
                            api('/api/camera/exempt', 'POST', {
                              examId: exemptExam,
                              studentId: s.id,
                            }),
                          'تم تسجيل الاستثناء',
                        );
                      }}
                    >
                      منح استثناء
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleStudents.length && (
            <div className="empty">
              <p>لا يوجد طلاب ضمن هذا البحث.</p>
              <button
                className="text-button"
                onClick={() => {
                  setQuery('');
                  setClassFilter('');
                }}
              >
                عرض كل الطلاب
              </button>
            </div>
          )}
          <div className="table-bottom">
            <label className="field">
              منح استثناء كاميرا لامتحان
              <select value={exemptExam} onChange={(e) => setExemptExam(e.target.value)}>
                <option value="">اختر امتحانًا</option>
                {exams
                  .filter((e) => e.cameraRequired)
                  .map((e) => (
                    <option value={e.id} key={e.id}>
                      {e.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </div>
      ) : (
        <div className="empty card">
          <h3>طلابك ينتظرون دعوتك</h3>
          <p>ابدأ بإضافة طالب أو استيراد قائمة الصف من CSV.</p>
        </div>
      )}
    </>
  );
}
export { default as SettingsView } from './Settings';
