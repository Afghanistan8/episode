import { AssuranceLookup } from "@/components/AssuranceLookup";

const FEATURES = [
  ["01", "Source truth", "Allow-listed public sources are read independently and reduced to stable, receipt-bound facts."],
  ["02", "Integrity graph", "Exact evidence reuse becomes a review signal, never an automatic denial."],
  ["03", "Policy guard", "A programme version can receive an independent, structured consensus review before a supplemental pool relies on it."],
  ["04", "Capital pool", "A separately funded GEN benefit can settle only after Episode finality and all assurance gates pass."],
];

export default function AssurancePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="marginal">Milestone / Episode assurance layer</p>
      <h1 className="display mt-3 max-w-3xl text-4xl sm:text-5xl">More evidence. Same Episode record.</h1>
      <p className="measure mt-5 text-bone-faint">
        The assurance layer is a group of companion intelligent contracts. It never changes Episode&apos;s programme, filing, finding, reserve, or payout rules.
      </p>
      <div className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2">
        {FEATURES.map(([index, name, note]) => <article key={index} className="bg-ink p-5 sm:p-6">
          <p className="marginal">{index} / 04</p><h2 className="display mt-3 text-2xl">{name}</h2><p className="mt-3 text-sm leading-6 text-bone-faint">{note}</p>
        </article>)}
      </div>
      <section className="mt-12"><p className="marginal">Public assurance record</p><h2 className="display mt-2 text-3xl">Read a companion finding.</h2><AssuranceLookup /></section>
    </div>
  );
}
