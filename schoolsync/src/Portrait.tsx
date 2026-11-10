import { useId } from 'react';
/** Original vector portraits: no external images, real people, or remote requests. */
export function Portrait({ variant = 0, adult = false }: { variant?: number; adult?: boolean }) {
  const id = useId().replace(/:/g, '');
  const colors = ['#92b9ef', '#94b4db', '#b0b9e3', '#8dbbcc'];
  const shirt = colors[variant % colors.length];
  return (
    <svg viewBox="0 0 220 250" className="student-portrait" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#fff" stopOpacity=".85" />
          <stop offset="1" stopColor={shirt} stopOpacity=".08" />
        </linearGradient>
      </defs>
      <circle cx="111" cy="111" r="91" fill={`url(#${id})`} />
      <path d="M38 250v-32c0-43 34-69 73-69s74 26 74 69v32" fill={shirt} />
      <path d="m81 164 30 39 31-39-14-11H94Z" fill="#f4f9ff" />
      <path d="M95 135h32v30c-7 12-25 12-32 0Z" fill="#debaa7" />
      <ellipse cx="111" cy="101" rx="41" ry="52" fill="#f2d7c6" />
      <path
        d={
          variant % 2 === 0
            ? 'M69 100c-9-38 7-66 39-67 41-2 56 30 44 69l-9-28c-27 4-35-10-35-10S91 81 76 76Z'
            : 'M68 99c-8-39 11-66 44-65 34 0 54 29 43 71l-12-26c-28 8-54-5-54-5L78 102Z'
        }
        fill="#3b4e66"
      />
      <path d="M85 99h15m22 0h15" stroke="#4b5a6e" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="93" cy="108" rx="2.2" ry="3" fill="#3d536c" />
      <ellipse cx="130" cy="108" rx="2.2" ry="3" fill="#3d536c" />
      <path
        d="M104 131q9 7 17-1"
        stroke="#be8c7a"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {adult && (
        <path
          d="M77 117q6 35 35 36 28-1 35-37c-9 15-14 19-35 18-19 1-27-5-35-17"
          fill="#3b4e66"
          opacity=".7"
        />
      )}
      <path d="m64 250 8-57m84 57-8-57" stroke="#fff" strokeOpacity=".25" strokeWidth="2" />
      {!adult && (
        <>
          <rect
            x="113"
            y="196"
            width="57"
            height="49"
            rx="5"
            fill="#f5f8ff"
            transform="rotate(-9 140 220)"
          />
          <path d="m123 211 34-5m-32 13 28-4m-27 12 31-5" stroke="#b7cdeb" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
