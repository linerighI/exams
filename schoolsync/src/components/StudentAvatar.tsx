/**
 * Reusable circular student/teacher initials avatar badge.
 */
import { initials } from '../ui';

export function StudentAvatar({
  name,
  initialsText,
  color = 'blue',
  size = 'md',
}: {
  name: string;
  initialsText?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const letters = initialsText || initials(name);
  return (
    <span className={`avatar ${size === 'lg' ? 'big' : ''} ${color}`} aria-hidden="true">
      {letters}
    </span>
  );
}
