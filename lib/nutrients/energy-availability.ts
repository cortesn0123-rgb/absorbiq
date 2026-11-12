/**
 * Energy availability (EA) = (energy intake − exercise energy expenditure) / fat-free mass.
 *
 * The IOC REDs consensus statements describe EA below ~30 kcal/kg FFM/day as low energy
 * availability, while noting the exact threshold is debated and differs between body systems
 * and between women and men. Evaluate a day only once its food is fully logged.
 */

import type { Sex } from "./registry";
import { exerciseEnergyKcal, type TrainingSession } from "./training";

export const LOW_EA_THRESHOLD_KCAL_PER_KG_FFM = 30;

export const EA_CITATION =
  "Mountjoy M et al. 2023 IOC consensus statement on Relative Energy Deficiency in Sport (REDs). Br J Sports Med. 2023;57:1073-1097; Mountjoy M et al. IOC consensus statement on RED-S: 2018 update. Br J Sports Med. 2018;52:687-697";

export interface BodyInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  /** Measured body fat %, if the user knows it. */
  bodyFatPct?: number | null;
}

export interface FatFreeMass {
  kg: number;
  /** True when estimated with the Boer formula because body fat % was not given. */
  estimated: boolean;
}

/**
 * Fat-free mass from body fat % when available; otherwise the Boer (1984) lean body mass formula:
 *   men   0.407 × kg + 0.267 × cm − 19.2
 *   women 0.252 × kg + 0.473 × cm − 48.3
 */
export function fatFreeMass({ sex, weightKg, heightCm, bodyFatPct }: BodyInput): FatFreeMass {
  if (bodyFatPct != null && bodyFatPct > 0 && bodyFatPct < 100) {
    return { kg: weightKg * (1 - bodyFatPct / 100), estimated: false };
  }
  const kg =
    sex === "male"
      ? 0.407 * weightKg + 0.267 * heightCm - 19.2
      : 0.252 * weightKg + 0.473 * heightCm - 48.3;
  // Keep the estimate physically sensible for unusual inputs.
  return { kg: Math.min(Math.max(kg, weightKg * 0.4), weightKg), estimated: true };
}

export interface EnergyAvailabilityInput extends BodyInput {
  /** Total energy eaten today, kcal. */
  intakeKcal: number;
  sessions: readonly TrainingSession[];
}

export interface EnergyAvailability {
  /** kcal per kg fat-free mass per day. */
  kcalPerKgFfm: number;
  ffmKg: number;
  exerciseKcal: number;
  /** True when EA is below the ~30 kcal/kg FFM threshold. */
  low: boolean;
  notes: string[];
}

export function assessEnergyAvailability(input: EnergyAvailabilityInput): EnergyAvailability {
  const ffm = fatFreeMass(input);
  const exerciseKcal = exerciseEnergyKcal(input.sessions, input.weightKg);
  const kcalPerKgFfm = (input.intakeKcal - exerciseKcal) / ffm.kg;
  const low = kcalPerKgFfm < LOW_EA_THRESHOLD_KCAL_PER_KG_FFM;

  const notes: string[] = [];
  if (low) {
    notes.push(
      `Estimated energy availability is under ~${LOW_EA_THRESHOLD_KCAL_PER_KG_FFM} kcal/kg fat-free mass. Low energy availability over time can affect health and performance; the exact threshold is debated.`,
    );
  }
  if (ffm.estimated) {
    notes.push(
      "Fat-free mass is estimated from height and weight; add your body fat % for a better figure.",
    );
  }
  if (input.sessions.length > 0) {
    notes.push("Exercise calories are estimated from training time and intensity.");
  }
  return { kcalPerKgFfm, ffmKg: ffm.kg, exerciseKcal, low, notes };
}
