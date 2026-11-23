"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import type { Tier } from "@/lib/nutrients/registry";
import type { ActivityLevel } from "@/lib/nutrients/targets";
import {
  cmToFtIn,
  kgToLb,
  type DietType,
  type Profile,
  type ProfileFormState,
} from "@/lib/profile";

export const TIER_OPTIONS: { value: Tier; label: string; description: string }[] = [
  {
    value: "fda",
    label: "FDA minimum",
    description:
      "FDA Daily Values from food labels: one set for all adults. Sodium, saturated fat, added sugars and cholesterol are limits.",
  },
  {
    value: "average",
    label: "Average",
    description:
      "National Academies DRIs for your age and sex, with calories from your height, weight and activity.",
  },
  {
    value: "athletic",
    label: "Athletic",
    description:
      "Average, plus sports-nutrition rules: protein and carbs scaled to your weight and training hours.",
  },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: "inactive", label: "Inactive", description: "Daily living only, mostly sitting" },
  { value: "low_active", label: "Low active", description: "Plus 30–60 min of walking or similar" },
  { value: "active", label: "Active", description: "Plus 1–2 h of moderate activity a day" },
  { value: "very_active", label: "Very active", description: "Plus 2 h or more a day" },
];

const DIET_OPTIONS: { value: DietType; label: string }[] = [
  { value: "omnivore", label: "Omnivore" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
];

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-300 bg-background px-3 text-base dark:border-zinc-700";
const legendClass = "mb-1 text-sm font-medium";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Radio buttons styled as large tappable options. */
function Choice<T extends string>({
  name,
  options,
  value,
  onChange,
  columns = false,
}: {
  name: string;
  options: { value: T; label: string; description?: string }[];
  value: T | null;
  onChange?: (value: T) => void;
  columns?: boolean;
}) {
  return (
    <div className={columns ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
      {options.map((o) => (
        <label
          key={o.value}
          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-3 py-2 has-checked:border-emerald-600 has-checked:bg-emerald-50 dark:border-zinc-800 dark:has-checked:bg-emerald-950"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            required
            defaultChecked={onChange ? undefined : value === o.value}
            checked={onChange ? value === o.value : undefined}
            onChange={onChange ? () => onChange(o.value) : undefined}
            className="mt-1 accent-emerald-600"
          />
          <span className="flex flex-col">
            <span>{o.label}</span>
            {o.description && <span className="text-xs text-muted">{o.description}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Profile setup (first login) and editing. Weight and height are entered in lb and ft/in. */
export function ProfileForm({
  profile,
  action,
  submitLabel,
}: {
  profile: Profile;
  action: (prev: ProfileFormState, formData: FormData) => Promise<ProfileFormState>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { error: null, saved: false });
  const [pending, startTransition] = useTransition();
  const [sex, setSex] = useState(profile.sex);
  const [lifeStage, setLifeStage] = useState(profile.lifeStage);
  const [trainingHours, setTrainingHours] = useState(String(profile.trainingHoursPerDay));
  const height = profile.heightCm === null ? null : cmToFtIn(profile.heightCm);
  const trains = Number(trainingHours) > 0;

  return (
    <form
      // Submitted by hand so React does not reset the fields after the action (that would wipe
      // the user's input when validation fails).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-6"
    >
      <Field label="Age" hint="You must be 14 or older.">
        <input
          name="age"
          type="number"
          inputMode="numeric"
          min={14}
          max={120}
          required
          defaultValue={profile.age ?? ""}
          className={inputClass}
        />
      </Field>

      <fieldset>
        <legend className={legendClass}>Sex</legend>
        <p className="mb-2 text-xs text-muted">
          Used to pick the right National Academies reference values.
        </p>
        <Choice
          name="sex"
          columns
          value={sex}
          onChange={(v) => {
            setSex(v);
            if (v === "male") setLifeStage("none");
          }}
          options={[
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
          ]}
        />
      </fieldset>

      {sex === "female" && (
        <fieldset className="flex flex-col gap-3">
          <legend className={legendClass}>Pregnancy or breastfeeding</legend>
          <Choice
            name="life_stage"
            value={lifeStage}
            onChange={setLifeStage}
            options={[
              { value: "none", label: "Neither" },
              { value: "pregnant", label: "Pregnant" },
              { value: "lactating", label: "Breastfeeding" },
            ]}
          />
          {lifeStage === "pregnant" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Weeks pregnant" hint="Optional">
                <input
                  name="gestation_weeks"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={42}
                  defaultValue={profile.gestationWeeks ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Weight before pregnancy (lb)" hint="Optional">
                <input
                  name="prepregnancy_weight_lb"
                  type="number"
                  inputMode="decimal"
                  min={50}
                  max={700}
                  step="any"
                  defaultValue={
                    profile.prepregnancyWeightKg === null
                      ? ""
                      : kgToLb(profile.prepregnancyWeightKg)
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          )}
          {lifeStage === "lactating" && (
            <Field label="Months since giving birth" hint="Optional">
              <input
                name="lactation_months"
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                defaultValue={profile.lactationMonthsPostpartum ?? ""}
                className={inputClass}
              />
            </Field>
          )}
        </fieldset>
      )}

      <Field label="Diet type">
        <select
          name="diet_type"
          required
          defaultValue={profile.dietType ?? ""}
          className={inputClass}
        >
          <option value="" disabled>
            Choose…
          </option>
          {DIET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Weight (lb)">
          <input
            name="weight_lb"
            type="number"
            inputMode="decimal"
            min={50}
            max={700}
            step="any"
            required
            defaultValue={profile.weightKg === null ? "" : kgToLb(profile.weightKg)}
            className={inputClass}
          />
        </Field>
        <Field label="Height (ft)">
          <input
            name="height_ft"
            type="number"
            inputMode="numeric"
            min={3}
            max={8}
            required
            defaultValue={height?.ft ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="(in)">
          <input
            name="height_in"
            type="number"
            inputMode="decimal"
            min={0}
            max={11.9}
            step="any"
            required
            defaultValue={height?.in ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <fieldset>
        <legend className={legendClass}>Activity level</legend>
        <p className="mb-2 text-xs text-muted">Your usual day, including exercise.</p>
        <Choice name="activity_level" value={profile.activityLevel} options={ACTIVITY_OPTIONS} />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={legendClass}>Training</legend>
        <Field
          label="Training hours per day"
          hint="Average on training days. Used by the Athletic tier."
        >
          <input
            name="training_hours"
            type="number"
            inputMode="decimal"
            min={0}
            max={12}
            step={0.25}
            required
            value={trainingHours}
            onChange={(e) => setTrainingHours(e.target.value)}
            className={inputClass}
          />
        </Field>
        {trains && (
          <Choice
            name="training_type"
            value={profile.trainingType === "none" ? null : profile.trainingType}
            options={[
              { value: "endurance", label: "Endurance", description: "Running, cycling, swimming" },
              { value: "strength", label: "Strength", description: "Lifting, power sports" },
              { value: "mixed", label: "Mixed", description: "A mix of both" },
            ]}
          />
        )}
      </fieldset>

      <fieldset>
        <legend className={legendClass}>Target tier</legend>
        <Choice name="target_tier" value={profile.targetTier} options={TIER_OPTIONS} />
      </fieldset>

      <details className="text-sm">
        <summary className="cursor-pointer py-1 text-zinc-600 dark:text-zinc-400">
          Optional: body fat %
        </summary>
        <div className="pt-2">
          <Field
            label="Body fat %"
            hint="Improves the low-energy-availability check. Leave blank to estimate it from height and weight."
          >
            <input
              name="body_fat_pct"
              type="number"
              inputMode="decimal"
              min={3}
              max={69}
              step="any"
              defaultValue={profile.bodyFatPct ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
      </details>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.saved && !pending && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          Saved. Your goals have been updated.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-lg bg-emerald-600 text-base font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
