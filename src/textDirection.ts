import { mathSegments } from './mathNotation';

// Use the prose rather than a leading formula (e.g. x^2 followed by Arabic).
// Ignore numbers, blanks and punctuation when deciding the reading direction.
export function textDirection(text: string): 'ltr' | 'rtl' {
  const prose = mathSegments(text || '')
    .filter((part) => !part.math)
    .map((part) => part.text)
    .join('');
  const firstLetter = prose.match(/\p{L}/u)?.[0];
  return firstLetter && /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(firstLetter) ? 'rtl' : 'ltr';
}
