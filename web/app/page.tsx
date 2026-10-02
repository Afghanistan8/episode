import Link from "next/link";

import { CategoryGlyph } from "@/components/Mark";
import { Lookup } from "@/components/Lookup";
import { Section } from "@/components/ui";
import { CATEGORIES } from "@/lib/validation";

const WHO = [
  ["Cultural galas and entertainment", "a flooded venue floor the night before the gala"],
  ["Ports and canals", "a berth that lay idle through a shift with no gang on it"],
  ["Supply chain and inventory", "a consignment wetted in the hold, inventory on hand lost"],
  ["Wildfire and storm surge", "a parcel the surge crossed, bounded and photographed"],
  ["Crop and drought", "a stand that did not come, shown in the field it did not come in"],
  ["Insurers, logistics desks and funds", "whoever is paying on the event, and needs it read"],
];

const GROUNDS: [string, string, boolean][] = [
  [
    "A photograph the node saw",
    "PNG or JFIF JPEG, read off the bytes. A frame a node cannot see counts " +
      "for nothing for that node.",
    true,
  ],
  [
    "An assessor's observation",
    "An independent attendance named on the programme, which is not the " +
      "sponsor's and not the claimant's.",
    true,
  ],
  [
    "Paperwork",
    "Read, weighed, and never enough on its own. A photographed document is " +
      "paperwork too.",
    false,
  ],
  [
    "An oracle index",
    "Not offered at all. Nothing Episode decides rests on a feed nobody " +
      "looked at.",
    false,
  ],
];

const NOT_OFFERED = [
  "published hazard feeds",
  "flight status",
  "AIS-only positions",
  "weather stations",
  "price ticks",
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="grid gap-12 pt-16 pb-4 sm:pt-24 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
        <div>
          <p className="marginal">consensus findings on events that have to be seen</p>
          <h1 className="display mt-5 text-[2.6rem] sm:text-[4rem]">
            Did it happen? The file decides, and no single party reads it.
          </h1>
          <p className="lede measure mt-7">
            Episode settles an event on photographs a panel of independent
            validators actually saw. The deterministic rules run first, in code,
            and name what is missing. Only then is anyone asked to look.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/filing" className="press press-filled">
              file an event
            </Link>
            <Link href="/programmes" className="press">
              open a programme
            </Link>
          </div>
        </div>

        <aside className="lg:border-l lg:border-rule lg:pl-8">
          <p className="marginal">what a rating may rest on</p>
          <dl className="mt-5 space-y-5">
            {GROUNDS.map(([head, body, carries]) => (
              <div key={head}>
                <dt className="flex items-baseline gap-2.5 text-sm">
                  <span
                    className={carries ? "text-established" : "text-refused"}
                    aria-hidden="true"
                  >
                    {carries ? "\u2713" : "\u2715"}
                  </span>
                  <span className="text-bone">{head}</span>
                </dt>
                <dd className="mt-1 pl-6 text-sm text-bone-faint">{body}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <Section label="four categories, and nothing else">
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {CATEGORIES.map((category) => (
            <div key={category.id} className="flex gap-4">
              <span className="pt-0.5">
                <CategoryGlyph category={category.id} />
              </span>
              <div>
                <h3 className="display text-lg">{category.label}</h3>
                <p className="mt-1 text-sm text-bone-faint">{category.note}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="measure mt-8 text-sm text-bone-dim">
          Each of the four is something a validator can look at. Business
          interruption qualifies when it is visible on the premises, the berth,
          the canal or the field — idling, blocked access, an unusable floor, a
          failed stand.
        </p>
      </Section>

      <Section label="what Episode does not offer">
        <div className="measure">
          <p className="text-sm text-bone-dim">
            No oracle indices: {NOT_OFFERED.join(", ")}. A link can be filed as a
            document the panel opens and reads, and it can neither prove nor
            disprove that the event happened.
          </p>
          <p className="mt-4 text-sm text-bone-dim">
            A rating of the scene stands on a photograph the validators actually
            saw, or on an independent assessor&rsquo;s observation. Paperwork
            corroborates and contradicts. It never carries the event.
          </p>
        </div>
      </Section>

      <Section label="who it is for">
        <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {WHO.map(([who, line]) => (
            <div key={who}>
              <dt className="text-sm text-bone">{who}</dt>
              <dd className="mt-1 text-sm text-bone-faint">{line}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section label="how a round is held">
        <ol className="measure space-y-5">
          {[
            [
              "Preflight, in code",
              "Programme open, version bound, windows, bond, reserve, the filing " +
                "cap, the photograph count, the required views, the required " +
                "document, the magic bytes, duplicates. A short file is refused " +
                "with its reason and never reaches a validator.",
            ],
            [
              "Sightings, before the claim",
              "Each validator looks at the photographs two at a time and says " +
                "what is in them, having been told nothing about what anyone " +
                "claims. One side's frames are never in the same call as the " +
                "other's.",
            ],
            [
              "Ratings, then grounding",
              "Every requirement in scope is rated on those sightings. The " +
                "grounding runs in code: a rating stands only on a frame that " +
                "node saw, paperwork grounds nothing, and the sponsor's own " +
                "photographs cannot sink a filing by themselves.",
            ],
            [
              "One fixed outcome",
              "The same ratings always give the same outcome, and the record " +
                "says which rule gave it. A leader cannot read as doubt to the " +
                "validators and as established on the file.",
            ],
          ].map(([heading, body], index) => (
            <li key={heading} className="flex gap-5">
              <span className="tabular pt-1 text-bone-ghost">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-sm text-bone">{heading}</h3>
                <p className="mt-1 text-sm text-bone-faint">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section label="look up a receipt">
        <Lookup />
      </Section>
    </div>
  );
}
