import { format } from "mathjs";
import getDigitCount from "./getDigitCount";

export default function formatNumber(number: number, maxDigits: number): string {
  if (isInfinity(number) || isComplex(number)) return "Error";

  if (isExponentialNotation(number)) {
    return handleExponentialNotation(number, maxDigits);
  }

  if (isOutsideFixedPointDisplayBounds(number, maxDigits)) {
    return formatExponentialNumberString(number.toExponential(), maxDigits);
  }
    
  return trimTrailingFractionalZeros(
    roundToMaximalPrecision(number, maxDigits)
  );
}

function handleExponentialNotation(exponentialNumber: number, maxDigits: number) {
  const exponentialNumberString = exponentialNumber.toString();
  const [_, exponent] = parseExponentialNotation(exponentialNumberString, 10);
  if (Math.abs(exponent) <= maxDigits) {
    const formattedNumber = convertToFixedNotation(exponentialNumber);
    if (!formattedNumber.includes("e") && getDigitCount(formattedNumber) <= maxDigits) {
      return formattedNumber;
    }
  }
  
  return formatExponentialNumberString(exponentialNumberString, maxDigits);
}

function convertToFixedNotation(number: number): string {
  return format(number, { notation: "fixed" });
}

function isOutsideFixedPointDisplayBounds(number: number, maxDigits: number) {
  const upperBound = Math.pow(10, maxDigits) - 1;
  const lowerBound =  1 / Math.pow(10, maxDigits);
  const absoluteNumber = Math.abs(number);
  return (absoluteNumber < lowerBound || absoluteNumber > upperBound);
}

function formatExponentialNumberString(exponentialNumberString: string, maxDigits: number): string {
  const [coefficient, exponent] = parseExponentialNotation(exponentialNumberString, 10);
  if (coefficient.toString().length > maxDigits) {
    const formattedCoefficient = trimTrailingFractionalZeros(roundToMaximalPrecision(coefficient, maxDigits));
    return `${formattedCoefficient}e${exponent}`;
  }

  return exponentialNumberString;
}

function parseExponentialNotation(exponentialNumber: string, base: number): [number, number] {
  const [coefficientStr, exponentStr] = exponentialNumber.split("e");
  const coefficient = parseFloat(coefficientStr);
  const exponent = parseInt(exponentStr, base);
  return [coefficient, exponent];
}

function isInfinity(number: number): boolean {
  return number === Infinity || number === -Infinity;
}

function isComplex(number: number): boolean {
  return typeof number === "object" && "re" in number;
}

function isExponentialNotation(number: number): boolean {
  return number.toString().includes("e");
}

function trimTrailingFractionalZeros(numberString: string): string {
  let decimalIndex = numberString.indexOf(".");
  if (decimalIndex === -1) return numberString;

  let endIndex = numberString.length - 1;
  while (numberString[endIndex] === "0" || numberString[endIndex] === ".") {
    if (numberString[endIndex] === ".") {
      decimalIndex = endIndex;
    }
    endIndex--;
  }

  return endIndex <= decimalIndex
    ? numberString.substring(0, decimalIndex)
    : numberString.substring(0, endIndex + 1);
}

function roundToMaximalPrecision(number: number, maxDigits: number): string {
  const fractionalDigits = computeAvailableFractionalDigits(number.toString(), maxDigits);
  return number.toFixed(fractionalDigits);
}

function computeAvailableFractionalDigits(numberString: string, maxDigits: number): number {
  const numberParts = numberString.split(".");
  if (numberParts.length < 2) return 0;
  const integerPart = numberParts[0];
  const numOfIntegerDigits = integerPart.replace("-", "").length;
  return maxDigits - numOfIntegerDigits;
}
