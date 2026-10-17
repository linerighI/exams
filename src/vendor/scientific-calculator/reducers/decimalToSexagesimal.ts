import type { CalcState } from "../types";

function decimalToSexagesimal(calc: CalcState) {
  const decimal = parseFloat(calc.currentOperand);
  const isNegative = decimal < 0;
  const absoluateDecimal = Math.abs(decimal);
  const degrees = Math.floor(absoluateDecimal);
  const remainingMinutes = (absoluateDecimal - degrees) * 60;
  const minutes = Math.floor(remainingMinutes);
  const remainingSeconds = (remainingMinutes - minutes) * 60;
  const seconds = Math.round(remainingSeconds);
  const sign = isNegative ? "-" : "";
  calc.output = `${sign}${degrees}°${minutes}’${seconds}”`;
}

export default decimalToSexagesimal;
