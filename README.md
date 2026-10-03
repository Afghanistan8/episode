# Episode

**Did it happen? The file decides, and no single party reads it.**

Episode is a GenLayer intelligent-contract application that verifies real-world
events for whoever pays on them. It settles an event on photographs a panel of
independent validators actually saw — not on a feed, and not on paperwork.

It is built for the people who write these risks and the people who carry them:
cultural galas and entertainment, port congestion and vessel idling, canal and
supply-chain delays, commodity inventory, wildfire and storm-surge damage
bounds, crop health and drought loss, and the insurers, logistics desks and
funds behind them.

---

## Only events that have to be seen

Four categories, and nothing else:

1. **Property damage** — venue, warehouse, parcel, crop stand, terminal.
2. **Vehicle damage** — truck, railcar, stage vehicle, support craft.
3. **Cargo damage or loss** — container, bulk, inventory on hand.
4. **Business interruption visible on the premises, berth, canal or field** —
   idling, blocked access, an unusable floor, a failed harvest stand.

Episode does not offer oracle indices: no published hazard feeds, no flight
status, no AIS-only positions, no weather stations, no price ticks. A link may
be filed as a document the panel opens and reads. Paperwork can neither prove
nor disprove that the event happened.

A rating of the scene stands on a photograph the validators saw, or on an
independent assessor's observation. Nothing else.

---

## How a round is held

**Preflight, in code.** Programme open, version bound, windows, bond, reserve
commitment, the per-account filing cap, the required photograph count, the
required views present as labels, the required document, the image magic bytes,
duplicate hashes, and — on appeal — whether the appellant actually filed
something new. A short file is refused with its reason and **never reaches a
validator**.

**Sightings, before the claim.** Each validator looks at the photographs two at
a time — the ceiling `gl.nondet.exec_prompt` takes — and reports what is in
them from a prompt that carries no claim text at all. A party's frames are
examined only beside that party's own frames, so one side can never caption the
other's picture.

**Ratings, then grounding.** Every requirement in scope is rated on those
sightings: each programme criterion, plus `subject`, plus `cause` and `papers`
where the file puts them in scope. The grounding then runs in code, on whatever
the node answered:

- a rating stands only on a frame that node saw, or on the assessor's observation
- paperwork grounds nothing, a photographed document included
- the sponsor's own frames cannot fail a requirement by themselves
- where an assessor's observation is on the file, the claimant's frames need it
  beside them to meet a criterion
- a conflict counts only when it names two exhibits on this filing
- a `NOT_SATISFIED` stands only if the evidence was enough to decide

**One fixed outcome.** Pure code, same ratings in, same outcome out:

| rule | when | outcome |
| --- | --- | --- |
| `R-OUT-1` | conflicting evidence, or not enough to decide | `UNDETERMINED` |
| `R-OUT-2` | any requirement not satisfied | `NOT_ESTABLISHED` |
| `R-OUT-3` | any requirement left open | `UNDETERMINED` |
| `R-OUT-4` | otherwise | `ESTABLISHED` |

**Equivalence.** Assessment and rehearing are the only nondeterministic writes.
Each uses `gl.vm.run_nondet_unsafe` with a validator that re-reads the stored
bytes, takes its own sightings, and accepts the leader only if it would record
the same outcome and the same failed requirements. A leader that omits a
photograph a validator saw is rejected. Nothing is compared with `strict_eq` on
free-text model output, and only the accepted structured result is stored.

The full specification, with every rule id the contract's comments point at, is
in **[`docs/rules.md`](docs/rules.md)**. The money is in
**[`docs/money.md`](docs/money.md)**.

---

## Roles

| role | may |
| --- | --- |
| **Sponsor** | write a programme, fund its reserve, pause new filings, publish a new version, draw idle reserve, appeal an established finding once |
| **Claimant** | file under a live version, post the bond, attach exhibits, ask for a panel, withdraw before the deadline, appeal a finding that went against them once |
| **Assessor** (optional, named on the programme, never the sponsor) | attach an observation that can ground a rating |
| **Anyone** | close a lapsed filing, seal a finding whose window has passed, and once an appeal's evidence period has shut, ask for a rehearing if the appellant filed something new or close the appeal if they did not |

---

## The file's life

```
                   convene            appeal           rehear
   OPEN ───────────────────► DETERMINED ──────► UNDER_APPEAL ─────► FINAL
     │                            │                   │
     │ retract                    │ seal              │ close_appeal
     ▼                            ▼                   ▼
  WITHDRAWN                     FINAL               FINAL
     
     │ close_lapsed
     ▼
   CLOSED
```

Versions are immutable and a filing keeps the version it was lodged under for
life. Pausing a programme stops new filings and nothing else.

---

## Money

A pull ledger only. No push payments.

| when | what moves |
| --- | --- |
| `ESTABLISHED`, once final | benefit and bond credited to the claimant; benefit leaves the reserve |
| `NOT_ESTABLISHED`, once final | bond joins the sponsor's reserve; benefit uncommitted back to it |
| `UNDETERMINED`, once final | bond back to the claimant; benefit back to the reserve |
| withdrawn before the evidence deadline | bond back; benefit back |
| closed after the deadline with no panel | bond forfeited to the reserve; benefit back |

Sealing is one atomic write. `withdraw()` pays the caller's ledger balance.
Idle reserve is `balance - committed`, and committed money is never idle, so a
sponsor cannot draw an award a live filing has been promised.

---

## Running it

### Tests — no network, no model, no chain

```bash
pip install pytest
pytest
```

The suite drives the contract itself against a small GenVM runtime double in
`tests/glfake/`, so every deterministic rule is proved by running the contract
rather than a copy of its arithmetic. 162 tests, covering each rule id in
`docs/rules.md`, including the worked example in `docs/money.md`.

```bash
cd web && npm install && npm test   # the TypeScript mirrors: 40 tests
```

### Deploying

Episode deploys to **Studionet** by default. The targets are the SDK's own
chain definitions rather than values written out in this repo, because the
chain id is signed over and a pair invented here would produce signatures the
network rejects:

| `EPISODE_NETWORK` | chain | endpoint |
| --- | --- | --- |
| `studionet` (default) | 61999 | `https://studio.genlayer.com/api` |
| `studio-devnet` | 61997 | `https://studio-dev.genlayer.com/api` |
| `localnet` | 61127 | `http://127.0.0.1:4000/api` |

Note that `61997` is **Devnet, on its own host** — it is not a second chain id
for Studio. An `EPISODE_RPC` override must use a chain ID defined by the SDK.
The scripts stop if the requested endpoint is down; they never switch chains
with the same signing key.

Studionet uses the published stable `genlayer-js` 1.1.8 release. Studio-dev
uses the separate 2.0 release candidate. The preview client sends a different
`addTransaction` selector: on stable Studionet it produced two finalized
`NO_MAJORITY` transactions with no assigned validators. The stable client sent
the selector used by successful Studionet deployments, and Episode finalized
with `MAJORITY_AGREE / SUCCESS`. The scripts select the SDK by chain ID.

On the preview chain, `scripts/client.mjs` estimates the fee policy for a
concrete write and submits its `distribution` and `feeValue`. Stable Studionet
does not expose that preview fee API, so its client uses the stable submission
format directly.

The chain object handed to the client is the SDK's own definition, used whole.
That matters beyond the chain id: the definition carries the consensus and fee
contract addresses, and a hand-rolled one leaves them wrong for the id, which
surfaces as "consensus main contract address not found" from *inside* the send,
after signing. An id the SDK does not define is refused up front rather than
guessed at. `EPISODE_RPC` overrides only the endpoint, and is passed to the
client as well as forced into the definition so neither can read the other's
URL by accident.

Settlement waits for finalization and then checks execution separately — a
transaction can finalize by consensus and still have reverted, and those are
two different questions.

The live Studionet deployment is recorded in `.episode-deploy.json` at
`0x9e6985b530A0c422E876C773b2d8b4e58E20b4f5`. All 31 public methods
were read back from that address, and three programmes were seeded. The seeder
verifies existing programmes before resuming, so a wait timeout does not
duplicate a successful write.

```bash
npm install

export EPISODE_PRIVATE_KEY=0x...          # required funded Studio key; process environment only
npm run deploy                            # writes .episode-deploy.json
npm run schema                            # reads the schema back off the chain
EPISODE_SEED_FILING=0 npm run seed        # three demo programmes, no filing
```

Switches:

| variable | effect |
| --- | --- |
| `EPISODE_NETWORK` | `studionet` (default), `studio-devnet` or `localnet` |
| `EPISODE_RPC`, `EPISODE_CHAIN_ID` | an endpoint of your own, taken as given |
| `EPISODE_CONTRACT` | work against an address already deployed |
| `EPISODE_RESERVE`, `EPISODE_AWARD`, `EPISODE_STAKE` | seeded amounts, in wei |
| `EPISODE_SEED_FILING=0` | seed the programmes without a demo filing |

The seeder opens the three demo programmes — gala venue water damage, berth
idling and cargo shift, storm-surge parcel bound — and **not** the contract's
constructor: a constructor-seeded programme would have a sponsor nobody
controls, and so could never be funded, paused or versioned. Its demo frames
are encoded as real PNGs on the way out, because Episode decides what an
exhibit is from its bytes and a placeholder would be filed as paperwork.

### The app

```bash
cd web
cp .env.example .env.local      # already contains the verified Studionet address
npm install
npm run dev
```

```
NEXT_PUBLIC_EPISODE_CHAIN_ID=61999
NEXT_PUBLIC_EPISODE_RPC=https://studio.genlayer.com/api
NEXT_PUBLIC_EPISODE_CONTRACT=0x9e6985b530A0c422E876C773b2d8b4e58E20b4f5
```

Reads and wallet writes on Studionet use the stable SDK. The header's wallet
picker discovers installed browser wallets, checks the configured chain and
passes the chosen provider to the write client. Wallet writes show the method,
value and transaction ID, then wait for a successful consensus and execution
result. The preview chains and fixture mode keep their transaction kit path.
The lodge form checks the connected account's live filing count, and payable
calls are blocked before signing unless they attach a positive value. Contract
reads stop waiting after 12 seconds and show the RPC, chain and address on
failure.

For working on the pages without a deployment, `NEXT_PUBLIC_EPISODE_FIXTURES=1`
answers the same views from a file held in memory and puts a banner across
every page. It is off in the default path and it decides nothing.

### Manual Vercel deployment

Import this repository in Vercel and set the **Root Directory** to `web`.
The build command is `npm run build`. `web/.env.production` supplies these
public values; use the same values if you set them in Vercel's dashboard:

```text
NEXT_PUBLIC_EPISODE_CHAIN_ID=61999
NEXT_PUBLIC_EPISODE_RPC=https://studio.genlayer.com/api
NEXT_PUBLIC_EPISODE_CONTRACT=0x9e6985b530A0c422E876C773b2d8b4e58E20b4f5
NEXT_PUBLIC_EPISODE_FIXTURES=0
```

The production build fails if Vercel overrides any of these values with a
different chain, RPC, contract, or fixture setting.

Do not put `EPISODE_PRIVATE_KEY` in Vercel: the browser app does not need it.

Pages: the four categories and a live receipt lookup; programmes with their
reserve, committed and idle; the filing, with preflight complaints inline and
every move it can take; and a shareable receipt that states the version which
bound the filing.

---

## Layout

```
contracts/episode.py     the intelligent contract, one file
  1. codes, rule ids, bounds
  2. pure helpers -- clock, media sniffing, fencing, grounding, outcome
  3. storage records
  4. class Episode -- sponsor calls, claimant calls, panel, money, reads

tests/                   pytest, driving the contract through a runtime double
  glfake/genlayer/       the double: fixed-width ints, storage, nondet, payouts
  helpers.py             accounts, a clock, image fixtures, a scripted panel

scripts/
  chain.mjs              SDK chain targets, with a liveness probe
  deploy.mjs             deploy and record the address
  schema.mjs             read the schema back and check the public surface
  seed.mjs               three demo programmes and a panel-ready file
  frames.mjs             a small PNG encoder, so the demo frames are real

web/                     Next.js App Router, TypeScript strict, Tailwind
  lib/outcome.ts         the outcome rule, mirrored
  lib/validation.ts      the preflight, mirrored for inline form errors
  lib/media.ts           the media sniff, mirrored
  lib/fixtures.ts        fixture mode, behind an env flag

docs/rules.md            the specification. Every rule id lives here.
docs/money.md            the arithmetic, with a worked example that is a test
```

The contract's runner pin is on the first line of `contracts/episode.py`:

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

---

## Where the judgement sits

Almost nowhere. The model is asked two questions: what is in this photograph,
and does what you saw meet this requirement. Everything else — what counts as a
photograph, whose frames may be read beside whose, what a rating may rest on,
what the ratings add up to, who may appeal, and where the money goes — is
settled in code before or after it is asked, and re-settled by every validator
over the same stored bytes.

That is the point of the tagline. The file decides, and no single party reads it.
