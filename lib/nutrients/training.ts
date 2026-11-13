/**
 * Training-day estimates shared by targets.ts and energy-availability.ts:
 * sweat loss, electrolytes lost in sweat, and exercise energy expenditure.
 * All values are population averages; individual sweat and energy cost vary widely.
 */

export const TRAINING_INTENSITIES = ["low", "moderate", "high", "very_high"] as const;
export type TrainingIntensity = (typeof TRAINING_INTENSITIES)[number];

export function isTrainingIntensity(value: unknown): value is TrainingIntensity {
  return (TRAINING_INTENSITIES as readonly unknown[]).includes(value);
}

/** One logged training session (matches the training_logs table). */
export interface TrainingSession {
  minutes: number;
  intensity: TrainingIntensity;
  /** Measured body mass lost during the session, kg. Preferred over the time-based estimate. */
  sweatLossKg?: number | null;
}

/** Typical athlete sweat rates are 0.5–2 L/h; used only when sweat loss was not measured. */
export const DEFAULT_SWEAT_RATE_L_PER_H = 1.0;

/**
 * Electrolytes lost per litre of sweat (1 kg sweat ≈ 1 L). Sweat sodium and chloride range
 * 10–90 mmol/L and potassium 2–8 mmol/L (Baker LB. Temperature. 2019;6(3):211-259); we use
 * typical athlete values: sodium 40 mmol/L (Baker LB. Sports Med. 2017;47(Suppl 1):111-128),
 * chloride 35 mmol/L, potassium 5 mmol/L.
 */
export const SWEAT_ELECTROLYTES_MG_PER_L = {
  sodium: 920, // 40 mmol/L × 22.99 mg/mmol
  chloride: 1241, // 35 mmol/L × 35.45 mg/mmol
  potassium: 196, // 5 mmol/L × 39.10 mg/mmol
} as const;

export const SWEAT_CITATION =
  "Baker LB. Sweating rate and sweat sodium concentration in athletes. Sports Med. 2017;47(Suppl 1):111-128; Baker LB. Physiology of sweat gland function. Temperature. 2019;6(3):211-259";

export interface SweatEstimate {
  /** Total sweat lost today, kg (≈ L). */
  kg: number;
  /** True when any session had no measured sweat loss and the default rate was used. */
  estimatedFromTime: boolean;
}

export function estimateSweatLoss(sessions: readonly TrainingSession[]): SweatEstimate {
  let kg = 0;
  let estimatedFromTime = false;
  for (const s of sessions) {
    if (s.sweatLossKg != null && s.sweatLossKg >= 0) {
      kg += s.sweatLossKg;
    } else if (s.minutes > 0) {
      kg += (s.minutes / 60) * DEFAULT_SWEAT_RATE_L_PER_H;
      estimatedFromTime = true;
    }
  }
  return { kg, estimatedFromTime };
}

/**
 * MET values by intensity, chosen within the Compendium of Physical Activities bands
 * (light < 3, moderate 3–6, vigorous > 6 METs; Ainsworth BE et al. 2011; Herrmann SD et al. 2024).
 */
export const INTENSITY_METS: Record<TrainingIntensity, number> = {
  low: 3,
  moderate: 5,
  high: 8,
  very_high: 10,
};

export const METS_CITATION =
  "Ainsworth BE et al. 2011 Compendium of Physical Activities. Med Sci Sports Exerc. 2011;43(8):1575-1581; Herrmann SD et al. 2024 Adult Compendium of Physical Activities. J Sport Health Sci. 2024;13(1):6-12";

/**
 * Exercise energy expenditure above resting, kcal: (MET − 1) × kg × hours.
 * Net of resting metabolism, as energy-availability methods require (1 MET ≈ 1 kcal/kg/h).
 */
export function exerciseEnergyKcal(sessions: readonly TrainingSession[], weightKg: number): number {
  return sessions.reduce(
    (sum, s) => sum + (INTENSITY_METS[s.intensity] - 1) * weightKg * (Math.max(s.minutes, 0) / 60),
    0,
  );
}
