/**
 * Student distraction-free study timer component displayed inside a modal sheet.
 */
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { tr } from '../translations';

export function FocusTimer() {
  const [duration, setDuration] = useState(25);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);

  useEffect(() => {
    if (!running) return;
    deadline.current = Date.now() + left * 1000;
    const timer = setInterval(() => {
      const val = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(val);
      if (!val) setRunning(false);
    }, 250);
    return () => clearInterval(timer);
  }, [running]);

  return (
    <div className="focus-content">
      <div
        className="focus-clock"
        role="timer"
        style={{ '--progress': `${(1 - left / (duration * 60)) * 100}%` } as React.CSSProperties}
      >
        <span>
          {String(Math.floor(left / 60)).padStart(2, '0')}
          <small>:{String(left % 60).padStart(2, '0')}</small>
        </span>
      </div>
      <div className="segmented">
        {[15, 25, 45].map((m) => (
          <button
            className={duration === m ? 'selected' : ''}
            disabled={running}
            key={m}
            onClick={() => {
              setDuration(m);
              setLeft(m * 60);
            }}
          >
            {m} {tr('min')}
          </button>
        ))}
      </div>
      <div className="focus-actions">
        <button
          className="icon-button secondary"
          aria-label={tr('Reset timer')}
          onClick={() => {
            setRunning(false);
            setLeft(duration * 60);
          }}
        >
          <RotateCcw size={18} />
        </button>
        <button className="primary" disabled={left === 0} onClick={() => setRunning(!running)}>
          {running ? <Pause size={17} /> : <Play size={17} />}
          {running ? tr('Pause for a moment') : tr('Let’s begin')}
        </button>
      </div>
    </div>
  );
}
