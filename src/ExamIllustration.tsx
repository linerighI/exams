export default function ExamIllustration({ subject }: { subject: string }) {
  const symbol = /رياض/.test(subject)
    ? 'x² + y²'
    : /كيمياء|فيزياء|علوم/.test(subject)
      ? 'H₂O'
      : /إنجليز/.test(subject)
        ? 'Aa'
        : 'أ ب';
  return (
    <svg
      className="exam-illustration"
      viewBox="0 0 300 130"
      role="img"
      aria-label={`أوراق امتحان ${subject}`}
    >
      <circle cx="222" cy="59" r="56" fill="#e3efff" />
      <circle cx="73" cy="85" r="24" fill="#edf5ff" />
      <g transform="translate(131 8) rotate(9 42 54)">
        <rect width="84" height="108" rx="9" fill="#b9d3f4" />
      </g>
      <g transform="translate(118 6) rotate(-6 42 54)">
        <rect width="84" height="108" rx="9" fill="white" stroke="#d1e2f7" />
        <rect x="13" y="15" width="36" height="5" rx="2" fill="#97b9e3" />
        {[33, 48, 63, 78].map((y) => (
          <g key={y}>
            <circle cx="17" cy={y} r="3" fill="none" stroke="#94b4df" />
            <path d={`M28 ${y}h40`} stroke="#dce8f8" strokeWidth="4" strokeLinecap="round" />
          </g>
        ))}
      </g>
      <text
        x="66"
        y="48"
        fill="#80a7d5"
        fontSize="22"
        fontFamily="serif"
        textAnchor="middle"
        direction="ltr"
      >
        {symbol}
      </text>
      <path
        d="m222 83 11 10 20-25"
        stroke="#83acd9"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
