import Fraction from "../classes/Fraction";
import { CalcState } from "../types";

function updateFractionInputsIfNeeded(calc: CalcState): void {
  if (shouldUpdateFractionInputs(calc)) {
    calc.fractionInputs.push(parseInt(calc.currentOperand));

    const fraction = Fraction.fromNumberArray(calc.fractionInputs);
    calc.currentOperand = fraction.toDecimal().toString();
    const useMixed = calc.fractionInputs.length > 2;
    calc.output = fraction.format(useMixed);
  }
}

function shouldUpdateFractionInputs(calc: CalcState) {
  return (    
    calc.numericMode === "fraction" && 
    calc.fractionInputs.length < 3 && 
    calc.currentOperand !== "0" && 
    calc.lastInput !== "=" && 
    calc.lastInput !== "frac" &&
    isInteger(parseFloat(calc.currentOperand))
  );
}

function isInteger(num: number) {
  return num === Math.floor(num);
}

export default updateFractionInputsIfNeeded;
