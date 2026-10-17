import type { CalcState } from "../types";

import formatNumber from "../utils/formatNumber";
import { MAX_DIGITS } from "../constants";

function inputSexagesimal(calc: CalcState) {
  const input = parseFloat(calc.currentOperand || calc.output);
  const isNegative = calc.sexagesimalInputs[0] < 0;
  calc.sexagesimalInputs.push(input);

  const total = calc.sexagesimalInputs.reduce((acc, val, i) => {
    const absoluteValue = Math.abs(val);
    return acc + absoluteValue / Math.pow(60, i);
  }, 0);

  const adjustedTotal = isNegative ? 0 - Math.abs(total) : Math.abs(total);
  calc.output = formatNumber(adjustedTotal, MAX_DIGITS);
  calc.currentOperand = adjustedTotal.toString();
  calc.lastInput = "sex";
  
  if (calc.sexagesimalInputs.length === 3) {
    calc.sexagesimalInputs= [];
  }
};

export default inputSexagesimal;
