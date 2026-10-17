import type { CalcState } from "../types";

import Fraction from "../classes/Fraction";
import formatNumber from "../utils/formatNumber";
import { FRACTION_BAR, MAX_DIGITS } from "../constants";

function fractionMode(calc: CalcState) {
    
  if (shouldConvertToDecimal(calc)) {
    calc.output = formatNumber(parseFloat(calc.currentOperand), MAX_DIGITS);
    calc.numericMode = "decimal";
    calc.lastInput = "frac-to-dec";
    return;
  }

  if (shouldConvertToFraction(calc)) {
    calc.output = Fraction
      .fromDecimal(parseFloat(calc.currentOperand))
      .format();
    calc.numericMode = "fraction";
    calc.lastInput = "dec-to-frac";
    return;
  }

  if (shouldAbort(calc)) {
    return;
  }

  if (calc.numericMode !== "fraction") {
    calc.fractionInputs = [];
  }

  calc.numericMode = "fraction";
  calc.fractionInputs.push(parseInt(calc.currentOperand));
  calc.currentOperand = "0";
  calc.lastInput = "frac";
  calc.output = `${calc.fractionInputs.join(FRACTION_BAR)}${FRACTION_BAR}`;  
};

function shouldConvertToDecimal(calc: CalcState): boolean {
  return calc.output.includes(FRACTION_BAR) && 
    (calc.lastInput === "=" || calc.lastInput === "dec-to-frac");
}

function shouldConvertToFraction(calc: CalcState): boolean {
  return calc.lastInput === "frac-to-dec";
}

function shouldAbort(calc: CalcState): boolean {
  return calc.lastInput === "=" || 
    calc.currentOperand === "0" || 
    calc.currentOperand.includes(".") || 
    calc.fractionInputs.length === 2;
}

export default fractionMode;
