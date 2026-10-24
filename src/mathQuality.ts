import katex from './mathRenderer';
import { mathSegments } from './mathNotation';
export type MathIssue = { field: string; message: string };
// Bounded arithmetic only. No eval, symbols, assignments, functions or network access.
export function numericChoice(value: string): number | undefined {
  let text = value
    .trim()
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\$|\$$/g, '')
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/−/g, '-')
    .replace(/٫/g, '.');
  for (let i = 0; i < 8; i++)
    text = text.replace(/\\(?:dfrac|tfrac|frac)\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))');
  text = text
    .replace(/\\(?:times|cdot)/g, '*')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[{}]/g, (c) => (c === '{' ? '(' : ')'));
  if (text.length > 160 || !/^[\d\s.+*/^()%eE-]+$/.test(text)) return;
  const tokens = text.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+*/^%\-]/g) || [];
  if (!tokens.length || tokens.length > 80 || tokens.join('') !== text.replace(/\s/g, '')) return;
  let pos = 0;
  const atom = (): number => {
    if (tokens[pos] === '(') {
      pos++;
      const n = sum();
      if (tokens[pos++] !== ')') throw Error();
      return n;
    }
    const token = tokens[pos++];
    if (!token || !/^\d|^\.\d/.test(token)) throw Error();
    return Number(token);
  };
  const power = (): number => {
    let n = atom();
    if (tokens[pos] === '^') {
      pos++;
      const exponent = unary();
      if (Math.abs(exponent) > 20) throw Error();
      n = n ** exponent;
    }
    if (tokens[pos] === '%') {
      pos++;
      n /= 100;
    }
    return n;
  };
  const unary = (): number =>
    tokens[pos] === '-' ? (pos++, -unary()) : tokens[pos] === '+' ? (pos++, unary()) : power();
  const product = (): number => {
    let n = unary();
    while (tokens[pos] === '*' || tokens[pos] === '/') {
      const op = tokens[pos++],
        right = unary();
      if (op === '/' && right === 0) throw Error();
      n = op === '*' ? n * right : n / right;
    }
    return n;
  };
  const sum = (): number => {
    let n = product();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const op = tokens[pos++],
        right = product();
      n = op === '+' ? n + right : n - right;
    }
    return n;
  };
  try {
    const n = sum();
    if (pos === tokens.length && Number.isFinite(n) && Math.abs(n) <= 1e12) return n;
  } catch {}
}
export function mathQuestionIssues(q: {
  text?: string;
  explanation?: string;
  options?: string[];
  image?: string;
  requiresImage?: boolean;
  kind?: string;
}): MathIssue[] {
  const issues: MathIssue[] = [];
  for (const [field, text] of [
    ['text', q.text],
    ['explanation', q.explanation],
    ...(q.options || []).map((value, i) => [`options.${i}`, value]),
  ] as [string, string | undefined][]) {
    if (!text) continue;
    if (
      (text.match(/\\\(/g) || []).length !== (text.match(/\\\)/g) || []).length ||
      (text.match(/\\\[/g) || []).length !== (text.match(/\\\]/g) || []).length
    ) {
      issues.push({ field, message: 'أغلق أقواس الصيغة الرياضية قبل الاعتماد.' });
      continue;
    }
    for (const segment of mathSegments(text)) {
      if (!segment.math) continue;
      try {
        katex.renderToString(segment.text, {
          throwOnError: true,
          trust: false,
          strict: 'error',
          maxExpand: 200,
          maxSize: 20,
        });
      } catch {
        issues.push({ field, message: 'صيغة رياضية غير قابلة للعرض. راجع الأقواس وأوامر LaTeX.' });
        break;
      }
    }
  }
  if (q.requiresImage && !q.image)
    issues.push({ field: 'image', message: 'السؤال يعتمد على رسم غير مرفق.' });
  if (!q.kind || q.kind === 'single' || q.kind === 'multiple') {
    const values = (q.options || []).map(numericChoice);
    for (let i = 0; i < values.length; i++)
      for (let j = 0; j < i; j++)
        if (
          values[i] !== undefined &&
          values[j] !== undefined &&
          Math.abs(values[i]! - values[j]!) <=
            Number.EPSILON * 8 * Math.max(Math.abs(values[i]!), Math.abs(values[j]!))
        )
          issues.push({
            field: `options.${i}`,
            message: `الخياران ${j + 1} و${i + 1} متكافئان عدديًا. غيّر أحدهما.`,
          });
  }
  return issues;
}
