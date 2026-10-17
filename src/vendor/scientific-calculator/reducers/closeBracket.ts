import type { CalcState } from "../types";

import ExpressionParser from "../classes/ExpressionParser";
import evaluate from "../utils/evaluate";
import formatNumber from "../utils/formatNumber";
import { MAX_DIGITS } from "../constants";
import updateFractionInputsIfNeeded from "./updateFractionInputsIfNeeded";
import Fraction from "../classes/Fraction";

function closeBracket(calc: CalcState) {
  if (!calc.isBracketOpen) return;

  updateFractionInputsIfNeeded(calc);

  calc.expression = [...calc.expression, calc.currentOperand, ")"];

  const bracketedExpression = new ExpressionParser(calc.expression).getLastBracketedExpression();
  const result = evaluate(bracketedExpression);
  
  calc.currentOperand = result.toString();
  calc.expression = stripBracketedExpression(bracketedExpression, calc.expression);
  calc.output = resolveOutput(result, calc);
  calc.isBracketOpen = isBracketOpen(calc.expression);
  calc.lastInput = ")";
  calc.fractionInputs = [];
}

function resolveOutput(result: number, calc: CalcState): string {
   if (calc.numericMode === "fraction") {
    const useMixed = calc.fractionInputs.length > 2
    return Fraction.fromDecimal(result).format(useMixed);
   }

   return formatNumber(result, MAX_DIGITS);
}

function stripBracketedExpression(bracketedExpression: string[], fromExpression: string[]): string[] {
  return fromExpression.slice(0, fromExpression.length - bracketedExpression.length)
}

function isBracketOpen(expression: string[]): boolean {
  return expression.indexOf("(") > -1;
}

export default closeBracket;

