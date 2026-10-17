export default function isOperator(candidate: string | undefined): boolean {
  return candidate 
    ? "/*-+".includes(candidate)
    : false;
}