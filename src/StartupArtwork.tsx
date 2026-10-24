import { Player } from '@remotion/player';
import { StartupMark } from '../onboarding-video/src/StartupMark';
export default function StartupArtwork({
  quiet,
  elapsed = 0,
}: {
  quiet: boolean;
  elapsed?: number;
}) {
  return (
    <Player
      component={StartupMark}
      inputProps={{ quiet }}
      compositionWidth={520}
      compositionHeight={230}
      durationInFrames={240}
      fps={60}
      initialFrame={quiet ? 239 : Math.min(239, Math.floor(elapsed * 60))}
      autoPlay={!quiet}
      controls={false}
      loop={false}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
