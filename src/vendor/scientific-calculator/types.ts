export type OperatorType = "+" | "-" | "*" | "/";
export type AngleUnit = "deg" | "rad" | "grad";
export type FunctionType = "square" | "sqrt" | "log10" | "powerOfTen" | "log" | "exp" | "cube" | "cbrt" | TrigFunctionType;
export type TrigFunctionType = "sin" | "cos" | "tan" | "asin" | "acos" | "atan" | "sinh" | "cosh" | "tanh" | "asinh" | "acosh" | "atanh";
export type NumericModeType = "decimal" | "fraction";

export interface CalcState {
  numericMode: NumericModeType;
  isShiftEnabled: boolean;
  isHyperbolic: boolean;
  angleMode: AngleUnit;
  currentOperand: string;
  fractionInputs: number[];
  sexagesimalInputs: number[];
  expression: string[];
  output: string;
  repeatOperationAffixes?: OperandAffixes;
  lastInput?: string;
  lastOperand?: string;
  isBracketOpen: boolean;
  voltageLevel: number;
}

export interface OperandAffixes {
  prefix: string;
  suffix: string;
}

export interface AdjustVoltagePayload {
  voltageLevel: number;
}

export interface ExecuteFunctionPayload {
  func: FunctionType;
}

export interface UpdateCurrentOperandPayload {
  input: string;
}
  
export interface UpdateExpressionPayload {
  operator: OperatorType;
}

export interface GetLastOperatorResultType {
  lastOperator: OperatorType | undefined;
  index: number;
};
