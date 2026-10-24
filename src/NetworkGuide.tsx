import { Player } from '@remotion/player';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
function NetworkFilm() {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const progress = interpolate(frame, [0, fps * 2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <svg viewBox="0 0 480 130" style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <path d="M100 48 H240 H380" fill="none" stroke="#dce8f8" strokeWidth="2" />
      <path
        d="M100 48 H240 H380"
        fill="none"
        stroke="#6c98d2"
        strokeWidth="2"
        strokeDasharray="280"
        strokeDashoffset={280 * (1 - progress)}
      />
      {[70, 210, 350].map((x, i) => (
        <g
          key={x}
          style={{
            opacity: interpolate(frame, [i * 0.2 * fps, (i * 0.2 + 0.4) * fps], [0.35, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <rect x={x} y="21" width="60" height="47" rx="12" fill="#f5f9ff" stroke="#88acd9" />
          <path
            d={`M${x + 15} 38 h30 v17 h-30 z M${x + 30} 55 v6`}
            fill="none"
            stroke="#6a8eba"
            strokeWidth="1.6"
          />
          <text
            x={x + 30}
            y="93"
            textAnchor="middle"
            fill="#42658f"
            fontFamily="Tajawal,Arial"
            fontSize="13"
          >
            {['المعلم', 'الشبكة', 'الطالب'][i]}
          </text>
        </g>
      ))}
      <text x="240" y="121" textAnchor="middle" fontSize="11" fontFamily="Arial" fill="#8299b7">
        Ethernet + Wi-Fi + Hotspot
      </text>
    </svg>
  );
}
export default function NetworkGuide({ quiet }: { quiet: boolean }) {
  return (
    <Player
      component={NetworkFilm}
      compositionWidth={480}
      compositionHeight={130}
      durationInFrames={120}
      fps={30}
      autoPlay={!quiet}
      initialFrame={quiet ? 119 : 0}
      controls={false}
      loop={false}
      style={{ width: '100%' }}
    />
  );
}
