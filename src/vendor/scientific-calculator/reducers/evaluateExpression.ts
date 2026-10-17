import type { CalcState, NumericModeType } from "../types";

import ExpressionParser from "../classes/ExpressionParser";
import Fraction from "../classes/Fraction";
import evaluate from "../utils/evaluate";
import formatNumber from "../utils/formatNumber";
import resolveCurrentOperand from "../utils/resolveCurrentOperand";
import updateFractionInputsIfNeeded from "./updateFractionInputsIfNeeded";
import { FRACTION_BAR, MAX_DIGITS } from "../constants";

function evaluateExpression(calc: CalcState) {
  
  if (calc.lastInput === "=") {
    repeatLastOperation(calc);
    return;
  }

  updateFractionInputsIfNeeded(calc);

  const currentOperand = resolveCurrentOperand(calc);
  const expression = [...calc.expression, currentOperand];
  const result = evaluate(expression);

  calc.currentOperand = result.toString();
  calc.expression = [];
  calc.repeatOperationAffixes = resolveRepeatOperationAffixes(calc, expression);
  calc.lastInput = "=";

  calc.numericMode = determineNumericMode(calc);
  calc.output = formatResult(result, calc.numericMode);

  calc.fractionInputs = [];
  calc.sexagesimalInputs = [];
  calc.isHyperbolic = false;
}

function repeatLastOperation(calc: CalcState) {
  const { prefix, suffix } = calc.repeatOperationAffixes!;
  const expression = [prefix, calc.currentOperand, suffix];
  const result = evaluate(expression);
  calc.currentOperand = result.toString(),

  calc.numericMode = determineNumericMode(calc);
  calc.output = formatResult(result, calc.numericMode);

  calc.fractionInputs = [];
  calc.sexagesimalInputs = [];
  calc.isHyperbolic = false;
}

function formatResult(result: number, numericMode: NumericModeType): string {
  if (numericMode === "decimal") {
    return formatNumber(result, MAX_DIGITS)
  }

  if (numericMode === "fraction") {
    return Fraction
      .fromDecimal(result)
      .format();
  }

  throw new Error("Non-supported numeric mode");
}

function resolveRepeatOperationAffixes(calc: CalcState, expression: string[])  {
  return calc.repeatOperationAffixes 
    ?? new ExpressionParser(expression).getRepeatOperationAffixes();
}

function determineNumericMode(calc: CalcState): NumericModeType {
  
  if (calc.lastInput === "=" && calc.output.includes(FRACTION_BAR)) {
    return "fraction";
  }
  
  return calc.fractionInputs.length === 0
    ? "decimal"
    : calc.numericMode;
}

export default evaluateExpression;
