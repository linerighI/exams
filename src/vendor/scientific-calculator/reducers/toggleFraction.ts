import type { CalcState } from "../types";

import Fraction from "../classes/Fraction";
import updateFractionInputsIfNeeded from "./updateFractionInputsIfNeeded";
import { FRACTION_BAR } from "../constants";
import formatNumber from '../utils/formatNumber';
import { MAX_DIGITS } from '../constants';

function toggleFraction(calc: CalcState) {
  if(calc.output.includes(FRACTION_BAR) && calc.fractionInputs.length===0){
    calc.output=formatNumber(Number(calc.currentOperand),MAX_DIGITS);calc.numericMode='decimal';calc.lastInput='frac-to-dec';return;
  }

  updateFractionInputsIfNeeded(calc);

  const fraction = resolveFraction(calc);
  const decimal = fraction.toDecimal();  
  const useMixed = decimal >= 1 && !isMixedFraction(calc.output);
  calc.output = fraction.format(useMixed);
  calc.currentOperand=decimal.toString();
  calc.numericMode='fraction';
  calc.lastInput = "dec-to-frac";
  calc.fractionInputs = [];
}

function resolveFraction(calc: CalcState) {
  return calc.fractionInputs.length > 1
    ? Fraction.fromNumberArray(calc.fractionInputs)
    : Fraction.fromDecimal(parseFloat(calc.currentOperand));
}

function isMixedFraction(str: string) {
  return countFractionBars(str) === 2;
}

function countFractionBars(str: string) {
  return str
    .split("")
    .filter(x => x === FRACTION_BAR)
    .length;
}

export default toggleFraction;
