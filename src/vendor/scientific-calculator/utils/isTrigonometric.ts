import { FunctionType } from "../types";

export function isTrigonometric(func: FunctionType) {
  return ["sin", "cos", "tan"].includes(func) || 
    isArc(func) || 
    isHyperbolic(func) || 
    isAreaHyperbolic(func);
}

export function isArc(func: FunctionType): boolean {
  return ["asin", "acos", "atan"].includes(func);
}

export function isHyperbolic(func: FunctionType): boolean {
  return ["sinh", "cosh", "tanh"].includes(func);
}

export function isAreaHyperbolic(func: FunctionType): boolean {
  return ["asinh", "acosh", "atanh"].includes(func);
}
