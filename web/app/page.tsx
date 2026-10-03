import Link from "next/link";

import { CategoryGlyph, Mark } from "@/components/Mark";
import { Lookup } from "@/components/Lookup";
import { LiveMarketLink } from "@/components/LiveMarketLink";
import { CATEGORIES } from "@/lib/validation";

const STEPS = [
  {
    number: "01",
    title: "Define the event",
    detail:
      "A sponsor opens a programme with a visible event, a fixed award, a reserve, and the conditions a filing must meet.",
  },
  {
    number: "02",
    title: "Build the file",
    detail:
      "A claimant binds that version, posts the bond, and adds scene photographs and any required documents.",
  },
  {
    number: "03",
    title: "Read the scene",
    detail:
      "Code checks the file first. Validators see the photographs, then rate the requirements on what they saw.",
  },
  {
    number: "04",
    title: "Keep the finding",
    detail:
      "A fixed rule turns the ratings into an outcome. The receipt keeps the version, grounds, and round together.",
  },
];

const AUDIENCE = [
  ["Events & venues", "A floor that cannot host the booking it was taken for."],
  ["Ports & logistics", "An idle berth, shifted cargo, or blocked route in view."],
  ["Property & land", "A bounded parcel, warehouse, or stand after loss."],
  ["Insurers & funds", "A finding with the evidence and the payment rule attached."],
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="marginal home-eyebrow">Evidence-led findings / GenLayer</p>
          <h1 className="display home-title">
            Episode — a receipt for a loss you can see.
          </h1>
          <p className="home-intro">
            Sponsors lock a programme. Claimants file the scene. Validators
            rate what is in the frames. One rule seals the finding.
          </p>
          <div className="home-actions">
            <Link href="/programmes" className="press press-filled">
              Explore programmes <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/filing" className="press">
              File an event <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="home-hero-footnote">
            Gala venues, berths, containers, storm parcels, drought stands.
          </p>
          <LiveMarketLink />
        </div>

        <aside className="home-hero-panel" aria-label="Episode evidence standard">
          <div className="home-panel-head">
            <span className="marginal">The reading standard</span>
            <span className="home-panel-index">EP / 01</span>
          </div>
          <div className="home-panel-mark">
            <Mark size={86} />
            <span className="home-panel-mark-label">One file. Independent eyes.</span>
          </div>
          <div className="home-panel-rows">
            <div>
              <span>01 / Scene</span>
              <strong>Photographs the node saw</strong>
            </div>
            <div>
              <span>02 / Observation</span>
              <strong>An independent assessor</strong>
            </div>
            <div>
              <span>03 / Finding</span>
              <strong>One rule, recorded on the receipt</strong>
            </div>
          </div>
          <p className="home-panel-note">
            Paper can support the file. It cannot establish the scene by itself.
          </p>
        </aside>
      </section>

      <div className="home-facts" aria-label="Episode at a glance">
        <div><strong>04</strong><span>visible event categories</span></div>
        <div><strong>02</strong><span>ways to ground a scene rating</span></div>
        <div><strong>01</strong><span>fixed outcome rule</span></div>
      </div>

      <section className="home-section" aria-labelledby="categories-heading">
        <div className="home-section-head">
          <div>
            <p className="marginal">Scope / 01</p>
            <h2 id="categories-heading" className="display home-section-title">
              What the programme will pay on.
            </h2>
          </div>
          <p>
            Property, vehicle, cargo, and visible business interruption. Each
            programme names the event and the scene the panel must judge.
          </p>
        </div>
        <div className="home-category-grid">
          {CATEGORIES.map((category, index) => (
            <Link href="/programmes" className="home-category" key={category.id}>
              <span className="home-category-top">
                <CategoryGlyph category={category.id} />
                <span>{String(index + 1).padStart(2, "0")} / 04</span>
              </span>
              <strong>{category.label}</strong>
              <span className="home-category-note">{category.note}</span>
              <span className="home-category-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="flow-heading">
        <div className="home-section-head">
          <div>
            <p className="marginal">Process / 02</p>
            <h2 id="flow-heading" className="display home-section-title">
              From event to receipt.
            </h2>
          </div>
          <p>
            Missing evidence is named before a panel is called. The same
            ratings always seal the same finding.
          </p>
        </div>
        <ol className="home-step-grid">
          {STEPS.map((step) => (
            <li key={step.number} className="home-step">
              <span className="home-step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section home-evidence" aria-labelledby="evidence-heading">
        <div>
          <p className="marginal">Grounds / 03</p>
          <h2 id="evidence-heading" className="display home-section-title">
            Grounds recorded on the file.
          </h2>
          <p className="home-evidence-copy">
            A rating stands on a frame a validator saw, or on an assessor&rsquo;s
            note. The sponsor&rsquo;s own frames cannot sink a filing by
            themselves. A clash has to name two exhibits. An appeal has to add
            something new.
          </p>
        </div>
        <div className="home-evidence-list">
          <div><span className="home-evidence-yes">✓</span><span>Scene photographs and assessor observations can ground a rating.</span></div>
          <div><span className="home-evidence-no">×</span><span>Documents can inform the panel, but cannot prove or disprove the event.</span></div>
          <div><span className="home-evidence-no">×</span><span>Oracle indices, price ticks, and feeds do not decide the scene.</span></div>
        </div>
      </section>

      <section className="home-section" aria-labelledby="audience-heading">
        <div className="home-section-head">
          <div>
            <p className="marginal">Use cases / 04</p>
            <h2 id="audience-heading" className="display home-section-title">
              Built for contested events.
            </h2>
          </div>
          <p>For the people paying on a loss, and the people who need that loss read fairly.</p>
        </div>
        <div className="home-audience-grid">
          {AUDIENCE.map(([name, description]) => (
            <div key={name}>
              <h3>{name}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="home-lookup" aria-labelledby="lookup-heading">
        <div>
          <p className="marginal">Public record</p>
          <h2 id="lookup-heading" className="display home-section-title">Find a receipt.</h2>
          <p>Look up the programme version, the exhibits, the round, and the rule on the receipt.</p>
        </div>
        <Lookup />
      </section>
    </div>
  );
}
