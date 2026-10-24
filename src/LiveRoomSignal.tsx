import { Player } from '@remotion/player';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
function Signal() {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const p = interpolate(frame, [0, fps * 1.5], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <svg viewBox="0 0 54 20" style={{ width: 54, height: 20 }} aria-hidden="true">
      <path
        d="M0 10H14L19 3 25 17 31 6 35 10H54"
        fill="none"
        stroke="#6f9dd4"
        strokeWidth="1.4"
        strokeDasharray="85"
        strokeDashoffset={85 * (1 - p)}
      />
    </svg>
  );
}
export default function LiveRoomSignal() {
  return (
    <Player
      component={Signal}
      fps={30}
      durationInFrames={60}
      compositionWidth={54}
      compositionHeight={20}
      autoPlay
      controls={false}
      loop={false}
      style={{ width: 54, height: 20, pointerEvents: 'none' }}
    />
  );
}
