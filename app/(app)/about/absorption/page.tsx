import Link from "next/link";

export const metadata = { title: "About absorption · AbsorbIQ" };

const SECTIONS = [
  {
    title: "Eaten and absorbed",
    body: [
      "For every nutrient the app shows two amounts: what you ate, from USDA FoodData Central, and an estimate of how much your body absorbed.",
      "Your body never takes in everything you eat. How much it absorbs depends on the nutrient, the form it comes in and what else is in the same meal.",
    ],
  },
  {
    title: "Each meal is worked out on its own",
    body: [
      "Breakfast, lunch and dinner are one meal each, and every snack is its own meal. Foods only affect each other when they are eaten together: orange juice at lunch helps the iron in lunch's lentils, not in dinner's.",
      "For each meal the app adds up what helps or hinders absorption, such as vitamin C, meat or fish, phytate (in whole grains and beans), calcium, fat, tea and coffee, then applies each nutrient's rule.",
    ],
  },
  {
    title: "Every number comes from published research",
    body: [
      "Each rule uses factors from published studies and official sources, and each factor has a low and a high value. That is why absorbed amounts are shown with a ~ and a range. Tap one to see the reasons.",
      "Vitamin A and folate are already reported by USDA in forms that include absorption, so the app does not adjust them a second time.",
    ],
  },
  {
    title: "Goals use what you ate",
    body: [
      "Goals are kept exactly as published (FDA Daily Values, the National Academies' intakes and the Dietary Guidelines). They are amounts to eat and already assume normal absorption, so progress bars always compare what you ate with the goal.",
      "The absorption score shows whether your food pairings helped. A score of 1 means typical absorption for what you ate. Above 1, your combinations were absorbed better than a typical diet; below 1, worse.",
    ],
  },
  {
    title: "The limits",
    body: [
      "These are estimates. Absorption varies a lot between people (genes, health, iron stores, digestion) and between meals, and the studies behind the factors were done on groups, not on you.",
      "If USDA has no value for a nutrient in a food, the app shows “no data” rather than guessing. Supplements and medicines are not included.",
      "AbsorbIQ is for information only and is not medical advice. If you are worried about a nutrient, a blood test and a doctor or dietitian can tell you more than any estimate.",
    ],
  },
];

export default function AboutAbsorptionPage() {
  return (
    <article className="flex max-w-prose flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">How absorption is estimated</h1>
      {SECTIONS.map((s) => (
        <section key={s.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          {s.body.map((p) => (
            <p key={p} className="leading-relaxed">
              {p}
            </p>
          ))}
        </section>
      ))}
      <p>
        <Link
          href="/about/absorption/details"
          className="font-medium text-emerald-700 underline underline-offset-4 dark:text-emerald-400"
        >
          Read the full technical notes
        </Link>{" "}
        <span className="text-muted">(every rule, factor and source)</span>
      </p>
    </article>
  );
}
