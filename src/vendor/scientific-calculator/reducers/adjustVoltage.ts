import type { PayloadAction } from "@reduxjs/toolkit";
import type { AdjustVoltagePayload, CalcState } from "../types";

function adjustVoltage(calc: CalcState, action: PayloadAction<AdjustVoltagePayload>) {
  calc.voltageLevel = action.payload.voltageLevel;
}

export default adjustVoltage;
