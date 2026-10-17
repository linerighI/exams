import { parse } from 'mathjs';
import { constructionSchema } from './geometry';

// Read only polynomial arithmetic, never evaluate user-supplied code or solve the question.
export function polynomialGraph(prompt: string) {
  const objects: { type: 'function'; name: string; coefficients: number[] }[] = [];
  prompt = prompt.replace(/\\\\([()[\]])/g, '\\$1');
  const expressions = [...prompt.matchAll(/\\\(([\s\S]*?)\\\)|\$([^$\n]+)\$/g)].map(
    (m) => m[1] || m[2],
  );
  if (!expressions.length && /^[\dxyXY\s.+*/^(){}=−-]+$/.test(prompt)) expressions.push(prompt);
  for (const original of expressions) {
    const expression = original
      .replace(/[{}]/g, '')
      .replace(/−/g, '-')
      .replace(/X/g, 'x')
      .replace(/Y/g, 'y')
      .trim();
    if (expression.length > 300 || !/^[\dxy\s.+*/^()=-]+$/.test(expression)) continue;
    const sides = expression.split('=');
    // A nonzero RHS needs deliberate interpretation; leave that to manual drawing or AI.
    if (sides.length > 2) continue;
    const source =
      sides.length === 2 && sides[0].trim() === 'y'
        ? sides[1]
        : sides.length === 2 && sides[1].trim() === '0'
          ? sides[0]
          : sides.length === 1
            ? sides[0]
            : '';
    if (!source || source.includes('y')) continue;
    try {
      const add = (a: number[], b: number[], sign = 1) =>
        Array.from(
          { length: Math.max(a.length, b.length) },
          (_, i) => (a[i] || 0) + sign * (b[i] || 0),
        );
      const multiply = (a: number[], b: number[]) => {
        if (a.length + b.length > 8) throw Error();
        const out = Array(a.length + b.length - 1).fill(0);
        a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
        return out;
      };
      const read = (node: any): number[] => {
        if (node.isConstantNode && Number.isFinite(Number(node.value))) return [Number(node.value)];
        if (node.isSymbolNode && node.name === 'x') return [0, 1];
        if (node.isParenthesisNode) return read(node.content);
        if (!node.isOperatorNode) throw Error();
        const a = read(node.args[0]);
        if (node.args.length === 1 && ['+', '-'].includes(node.op))
          return a.map((n) => (node.op === '-' ? -n : n));
        const b = read(node.args[1]);
        if (node.op === '+') return add(a, b);
        if (node.op === '-') return add(a, b, -1);
        if (node.op === '*') return multiply(a, b);
        if (node.op === '/' && b.length === 1 && b[0] !== 0) return a.map((n) => n / b[0]);
        if (node.op === '^' && b.length === 1 && Number.isInteger(b[0]) && b[0] >= 0 && b[0] <= 6) {
          let out = [1];
          for (let i = 0; i < b[0]; i++) out = multiply(out, a);
          return out;
        }
        throw Error();
      };
      const coefficients = read(parse(source));
      if (coefficients.length < 2) continue;
      const object = {
        type: 'function' as const,
        name: ['f', 'g', 'h', 'p', 'q', 'r'][objects.length],
        coefficients: coefficients.map((n) => Math.round(n * 1e6) / 1e6),
      };
      constructionSchema.parse({ objects: [object] });
      objects.push(object);
      if (objects.length === 6) break;
    } catch {
      /* Unsupported expressions remain editable; never guess a graph. */
    }
  }
  return objects.length ? constructionSchema.parse({ objects }) : undefined;
}
