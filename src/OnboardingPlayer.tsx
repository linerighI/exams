import { useEffect, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { WelcomeFilm, type FilmVariant } from '../onboarding-video/src/WelcomeFilm';
export default function OnboardingPlayer({
  variant,
  onDone,
  stopped = false,
}: {
  variant: FilmVariant;
  onDone: () => void;
  stopped?: boolean;
}) {
  const player = useRef<PlayerRef>(null),
    done = useRef(onDone),
    [remaining, setRemaining] = useState(10),
    [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  done.current = onDone;
  const halted = useRef(stopped);
  halted.current = stopped;
  useEffect(() => {
    if (stopped) player.current?.pause();
  }, [stopped]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'),
      change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const instance = player.current;
    if (!instance) return;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setRemaining(0);
      done.current();
    };
    const frame = ({ detail }: { detail: { frame: number } }) =>
      setRemaining(Math.max(0, 10 - Math.floor(detail.frame / 30)));
    const visibility = () => {
      if (document.hidden) instance.pause();
      else if (!finished && !halted.current) void instance.play();
    };
    instance.addEventListener('ended', finish);
    instance.addEventListener('error', finish);
    instance.addEventListener('frameupdate', frame);
    document.addEventListener('visibilitychange', visibility);
    // A failed font/player must never trap someone at sign-in.
    const timeout = setTimeout(finish, 14000);
    return () => {
      clearTimeout(timeout);
      instance.removeEventListener('ended', finish);
      instance.removeEventListener('error', finish);
      instance.removeEventListener('frameupdate', frame);
      document.removeEventListener('visibilitychange', visibility);
      instance.pause();
    };
  }, []);
  return (
    <div className="onboarding-player" aria-label="عرض تعريفي مدته عشر ثوانٍ">
      <div aria-hidden="true" dir="ltr">
        <Player
          ref={player}
          component={WelcomeFilm}
          inputProps={{ variant, reducedMotion: reduced }}
          durationInFrames={300}
          fps={30}
          compositionWidth={1280}
          compositionHeight={720}
          autoPlay
          initiallyMuted
          controls={false}
          loop={false}
          moveToBeginningWhenEnded={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          numberOfSharedAudioTags={0}
          style={{ width: '100%', aspectRatio: '16/9' }}
          errorFallback={() => (
            <div className="onboarding-unavailable">مساحتك جاهزة. يمكنك المتابعة الآن.</div>
          )}
        />
      </div>
      <div className="onboarding-progress">
        <span style={{ width: `${(10 - remaining) * 10}%` }} />
      </div>
      <span className="onboarding-duration">
        {remaining ? `${remaining} ثوانٍ` : 'اختر خطوتك التالية'}
      </span>
    </div>
  );
}
