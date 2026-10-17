import { useState } from 'react';
import reducer, { calcSlice, initialState } from './vendor/scientific-calculator/calcSlice';
import type { FunctionType, OperatorType } from './vendor/scientific-calculator/types';
import './scientificCalculator.css';
const actions = calcSlice.actions;
export default function ScientificCalculator() {
  const [state, setState] = useState(initialState),
    [error, setError] = useState('');
  const dispatch = (action: Parameters<typeof reducer>[1]) => {
    try {
      const next = reducer(state, action);
      if (!Number.isFinite(Number(next.currentOperand)))
        throw Error('العملية خارج مجال الأعداد الحقيقية');
      setState(next);
      setError('');
    } catch {
      setError('عملية غير صالحة. راجع الأعداد والأقواس ثم اضغط AC للمسح.');
    }
  };
  const digit = (s: string) => dispatch(actions.updateCurrentOperand({ input: s }));
  const op = (operator: OperatorType) => dispatch(actions.updateExpression({ operator }));
  const fn = (func: FunctionType) => dispatch(actions.executeFunction({ func }));
  const funcs: [string, FunctionType][] = [
    ['√', 'sqrt'],
    ['x²', 'square'],
    ['x³', 'cube'],
    ['∛', 'cbrt'],
    ['log', 'log10'],
    ['ln', 'log'],
    ['10ˣ', 'powerOfTen'],
    ['eˣ', 'exp'],
    ['sin', 'sin'],
    ['cos', 'cos'],
    ['tan', 'tan'],
    ['sin⁻¹', 'asin'],
    ['cos⁻¹', 'acos'],
    ['tan⁻¹', 'atan'],
  ];
  return (
    <div
      className="school-scientific"
      dir="ltr"
      tabIndex={0}
      aria-label="آلة حاسبة علمية"
      onKeyDown={(e) => {
        if (/^[0-9.]$/.test(e.key)) {
          e.preventDefault();
          digit(e.key);
        } else if (/^[+*/-]$/.test(e.key)) {
          e.preventDefault();
          op(e.key as OperatorType);
        } else if (e.key === 'Enter' || e.key === '=') {
          e.preventDefault();
          dispatch(actions.evaluateExpression());
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          dispatch(actions.backspace());
        } else if (e.key === 'Delete') {
          e.preventDefault();
          dispatch(actions.allClear());
        }
      }}
    >
      <header>
        <strong>
          SCHOOL <span>SCIENTIFIC</span>
        </strong>
        <small>FX · Offline</small>
      </header>
      <div className="scientific-screen">
        <div>
          <span>{state.angleMode.toUpperCase()}</span>
          <span>{state.numericMode === 'fraction' ? 'FRAC' : 'REAL'}</span>
        </div>
        <small className="scientific-expression">
          {state.expression.join(' ') || 'جاهزة للحساب'}
        </small>
        <output className="calculator-result" aria-label="نتيجة الآلة الحاسبة" aria-live="polite">
          {error ? 'Math ERROR' : state.output}
        </output>
      </div>
      {error && (
        <p className="scientific-error" role="alert" dir="rtl">
          {error}
        </p>
      )}
      <div className="scientific-modes">
        <button onClick={() => dispatch(actions.cycleDrgMode())} aria-label="تغيير وحدة الزوايا">
          {state.angleMode.toUpperCase()} ↻
        </button>
        <button onClick={() => dispatch(actions.fractionMode())}>a b/c</button>
        <button onClick={() => dispatch(actions.toggleFraction())}>S ⇄ D</button>
        <button onClick={() => dispatch(actions.invertSign())}>+ / −</button>
      </div>
      <div className="scientific-functions">
        {funcs.map(([label, func]) => (
          <button key={func} aria-label={`الدالة ${label}`} onClick={() => fn(func)}>
            {label}
          </button>
        ))}
        <button onClick={() => dispatch(actions.openBracket())}>(</button>
        <button onClick={() => dispatch(actions.closeBracket())}>)</button>
      </div>
      <div className="scientific-digits">
        {[
          '7',
          '8',
          '9',
          'DEL',
          'AC',
          '4',
          '5',
          '6',
          '×',
          '÷',
          '1',
          '2',
          '3',
          '+',
          '−',
          '0',
          '.',
          'π',
          '%',
          '=',
        ].map((label) => (
          <button
            key={label}
            className={label === '=' ? 'equals' : label === 'AC' || label === 'DEL' ? 'clear' : ''}
            onClick={() => {
              if (/^[0-9.]$/.test(label)) digit(label);
              else if (['×', '÷', '+', '−'].includes(label))
                op(({ '×': '*', '÷': '/', '+': '+', '−': '-' } as const)[label as '×']);
              else if (label === 'AC') dispatch(actions.allClear());
              else if (label === 'DEL') dispatch(actions.backspace());
              else if (label === 'π') dispatch(actions.expOrPi());
              else if (label === '%') dispatch(actions.percent());
              else dispatch(actions.evaluateExpression());
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="scientific-hint" dir="rtl">
        أدخل العدد ثم اضغط الدالة. اختر DEG للدرجات أو RAD للراديان.
      </p>
      <small className="scientific-credit">Simon Cragg · MIT · Math.js · CASIO-inspired</small>
    </div>
  );
}
