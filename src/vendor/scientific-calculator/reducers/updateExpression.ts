import type { PayloadAction } from "@reduxjs/toolkit";
import type { CalcState, NumericModeType, OperatorType, UpdateExpressionPayload } from "../types";

import ExpressionParser from "../classes/ExpressionParser";
import Fraction from "../classes/Fraction";
import evaluate from "../utils/evaluate";
import formatNumber from "../utils/formatNumber";
import isOperator from "../utils/isOperator";
import resolveCurrentOperand from "../utils/resolveCurrentOperand";
import updateFractionInputsIfNeeded from "./updateFractionInputsIfNeeded";
import { MAX_DIGITS } from "../constants";

function updateExpression(calc: CalcState, action: PayloadAction<UpdateExpressionPayload>) {
  const { operator } = action.payload;
  if (operator === calc.lastInput) return;
  
  updateFractionInputsIfNeeded(calc);

  const currentOperand = resolveCurrentOperand(calc);
  const expression = resolveExpression(currentOperand, calc);

  calc.expression = [...expression, operator];
  calc.currentOperand = "0";
  calc.lastOperand = currentOperand;
  calc.lastInput = operator;
  calc.output = resolveOutput(currentOperand, expression, operator, calc.numericMode);
  calc.numericMode = "decimal";
  calc.fractionInputs = [];
  calc.sexagesimalInputs = [];
}

function resolveExpression(currentOperand: string, calc: CalcState): string[] {
  return isOperator(calc.lastInput)
    ? calc.expression.slice(0, -1)
    : [...calc.expression, currentOperand];
}

function resolveOutput(
  currentOperand: string, 
  expression: string[], 
  operator: OperatorType,
  numericMode: NumericModeType
): string {
  return numericMode === "fraction" 
    ? Fraction.fromDecimal(parseFloat(currentOperand)).format()
    : buildOutputForNewOperator(currentOperand, expression, operator);
}

function buildOutputForNewOperator(
  operand: string, 
  expression: string[], 
  newOperator: OperatorType,
): string {

  const parser = new ExpressionParser(expression);
  const expressionToEvaluate = parser.getExpressionToEvaluate(newOperator);

  if (expressionToEvaluate) {
    const evaluation = evaluate(expressionToEvaluate);
    return formatNumber(evaluation, MAX_DIGITS);
  }

  return formatNumber(parseFloat(operand), MAX_DIGITS);
}

export default updateExpression;
