// Conservatively display common legacy notation. Never rewrite the stored question.
export function mathSegments(text: string): { text: string; math?: boolean; display?: boolean }[] {
  const delimited = text.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+\$)/g);
  return delimited.flatMap((part) => {
    const display = part.startsWith('$$') || part.startsWith('\\[');
    const marked = display || part.startsWith('\\(') || part.startsWith('$');
    if (marked)
      return [
        {
          text: part.slice(
            display || part.startsWith('\\(') ? 2 : 1,
            display || part.startsWith('\\(') ? -2 : -1,
          ),
          math: true,
          display,
        },
      ];
    // Limit automatic interpretation to familiar math tokens, not English prose or identifiers.
    const regex =
      /(?:\b(?:sin|cos|tan|cot|sec|csc|log|ln)\s*\(?\s*-?\d+(?:\.\d+)?\s*(?:[o°]|\^\{?\d+\}?)?\s*\)?|\b[xyz](?:\^\{?[+-]?\d+\}?|[²³]|[23](?![\w]))|√\s*\(?[\dxyz]+\)?|[α-ωθπ]|\b\d+\s*\/\s*\d+\b)(?:\s*[=+−≈≤≥×÷*/-]\s*(?:-?\d+(?:\.\d+)?|[xyz](?:\^\{?\d+\}?|[²³]|[23](?![\w]))?|\b(?:sin|cos|tan)\s*\d+(?:[o°])?))*/g;
    const result: { text: string; math?: boolean }[] = [];
    let last = 0;
    for (const match of part.matchAll(regex)) {
      const index = match.index!;
      if (index > last) result.push({ text: part.slice(last, index) });
      result.push({ text: legacyMath(match[0]), math: true });
      last = index + match[0].length;
    }
    if (last < part.length) result.push({ text: part.slice(last) });
    if (!result.length) result.push({ text: part });
    // Whole numeric options need LTR isolation, especially negative values in Arabic.
    if (result.length === 1 && /^\s*[+-]?\d+(?:\.\d+)?\s*$/.test(part))
      return [{ text: part.trim(), math: true }];
    return result;
  });
}
function legacyMath(s: string) {
  return s
    .replace(/\b(sin|cos|tan|cot|sec|csc|log|ln)\b/g, '\\$1')
    .replace(/(\d)\s*[o°](?![a-zA-Z])/g, '$1^{\\circ}')
    .replace(/([xyz])[²³]/g, (_, x, n) => `${x}^{${n === '²' ? 2 : 3}}`)
    .replace(/\b([xyz])([23])\b/g, '$1^{$2}')
    .replace(/√\s*\(?([\dxyz]+)\)?/g, '\\sqrt{$1}')
    .replace(/θ/g, '\\theta')
    .replace(/π/g, '\\pi')
    .replace(/≈/g, '\\approx ')
    .replace(/≤/g, '\\leq ')
    .replace(/≥/g, '\\geq ')
    .replace(/×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/−/g, '-');
}
