export function LearningArt() {
  return (
    <svg className="learning-art" viewBox="0 0 430 280" role="img" aria-label="كتب وقلم وكأس نجاح">
      <defs>
        <linearGradient id="book" x2="1" y2="1">
          <stop stopColor="#65b9ff" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="cup" x2="0.8" y2="1">
          <stop stopColor="#fff2b0" />
          <stop offset="1" stopColor="#f2b43a" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#174dba" floodOpacity=".22" />
        </filter>
      </defs>
      <circle cx="215" cy="140" r="106" fill="#fff" opacity=".09" />
      <circle
        cx="215"
        cy="140"
        r="126"
        stroke="#fff"
        strokeDasharray="5 10"
        fill="none"
        opacity=".25"
      />
      <g transform="translate(91 168) rotate(-10)" filter="url(#shadow)">
        <rect width="208" height="51" rx="12" fill="#d5eaff" />
        <rect x="12" y="8" width="187" height="33" rx="5" fill="#fff" />
        <path d="M30 18H178M30 27H170M30 34H180" stroke="#c4dbf9" strokeWidth="3" />
        <rect width="15" height="51" rx="6" fill="#6d9be9" />
      </g>
      <g transform="translate(111 118) rotate(8)" filter="url(#shadow)">
        <rect width="197" height="60" rx="12" fill="url(#book)" />
        <rect x="17" y="10" width="170" height="41" rx="4" fill="#eef7ff" />
        <path d="M33 23H167M33 32H170M33 41H155" stroke="#c6d9f2" strokeWidth="3" />
        <rect width="19" height="60" rx="7" fill="#1774d1" />
      </g>
      <g transform="translate(187 30)" filter="url(#shadow)">
        <path d="M7 14H81L73 60Q44 103 16 60Z" fill="url(#cup)" />
        <path
          d="M12 24H-6Q-14 66 24 69M76 24H94Q105 66 64 69"
          stroke="#ffd873"
          strokeWidth="9"
          fill="none"
        />
        <rect x="36" y="76" width="16" height="28" rx="4" fill="#efb63e" />
        <rect x="18" y="101" width="53" height="13" rx="5" fill="#ffe190" />
        <path d="M44 28L49 39L61 40L52 49L54 62L44 55L33 62L36 49L26 40L39 39Z" fill="#fff8d9" />
      </g>
      <g transform="translate(316 75) rotate(25)">
        <rect width="20" height="140" rx="6" fill="#d6edff" />
        <rect y="17" width="20" height="105" fill="#a7d9ff" />
        <path d="M0 122L10 148L20 122" fill="#ffe2ad" />
        <path d="M7 139L10 148L13 139" fill="#2f4a7b" />
      </g>
      <g fill="#fff">
        <path d="M90 62l5 12 12 5-12 5-5 12-5-12-12-5 12-5Z" opacity=".85" />
        <path d="M350 209l4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" opacity=".8" />
        <circle cx="357" cy="44" r="5" />
        <circle cx="73" cy="206" r="4" />
      </g>
      <g transform="translate(62 108) rotate(-12)">
        <rect width="57" height="57" rx="17" fill="#fff" />
        <path
          d="M17 30l8 8 17-20"
          stroke="#3b86ed"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
