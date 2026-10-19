import { useRef } from 'react';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { useSceneMotion } from './appMotion';
import type { ExamIssue } from './examValidation';
import './appMotion.css';
export default function ExamIssues({
  issues,
  onSelect,
}: {
  issues: ExamIssue[];
  onSelect: (issue: ExamIssue) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useSceneMotion(ref, 'li', issues);
  if (!issues.length) return null;
  return (
    <div ref={ref} className="exam-issues" role="alert">
      <header>
        <CircleAlert size={20} />
        <div>
          <strong>نصلحها خطوة بخطوة</strong>
          <p>اضغط على الملاحظة للانتقال إلى مكانها.</p>
        </div>
        <span>{issues.length}</span>
      </header>
      <ul>
        {issues.map((issue, i) => (
          <li key={`${issue.path.join('.')}-${i}`}>
            <button type="button" onClick={() => onSelect(issue)}>
              <span>{issue.message}</span>
              <ArrowLeft size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
