import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
export default function LoginWallpaper() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        const tiles = root.current!.querySelectorAll('i');
        const drift = gsap.to(tiles, {
          y: (i) => (i % 2 ? -24 : 20),
          x: (i) => (i % 2 ? 12 : -10),
          rotation: (i) => (i % 2 ? 4 : -4),
          duration: 12,
          stagger: 0.8,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
        const visibility = () => {
          if (document.hidden) drift.pause();
          else drift.resume();
        };
        document.addEventListener('visibilitychange', visibility);
        visibility();
        return () => document.removeEventListener('visibilitychange', visibility);
      },
      root.current,
    );
    return () => media.revert();
  }, []);
  return (
    <div ref={root} className="login-wallpaper" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}
