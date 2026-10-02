# Episode: the rules

> Did it happen? The file decides, and no single party reads it.

This document is the specification. Every rule has an id; `contracts/episode.py`
points at these ids and does not restate them. Where a comment in the contract
and a rule here disagree, this document is right and the contract is the bug.

Every rule marked **code** is settled deterministically, before any validator
is asked anything. Only the panel's ratings are not, and even there the
grounding and the outcome run in code over whatever a node answered.

The pytest suite in `tests/` drives these rules through the contract itself.
Where a rule names its test, that is the test that holds it.

---

## Scope: what Episode will decide

Episode offers only events that have to be seen. Four categories, and nothing
else:

| id | category | what it covers |
| --- | --- | --- |
| 1 | property damage | venue, warehouse, parcel, crop stand, terminal |
| 2 | vehicle damage | truck, railcar, stage vehicle, support craft |
| 3 | cargo damage or loss | container, bulk, inventory on hand |
| 4 | business interruption visible on the premises, berth, canal or field | idling, blocked access, unusable floor, failed harvest stand |

Episode does not offer oracle indices: published hazard feeds, flight status,
AIS-only positions, weather stations, price ticks. A link may be stored as a
document the panel opens and reads. Paperwork can neither prove nor disprove
that the event happened.

---

## R-PRG — programmes and versions

| rule | statement | enforced |
| --- | --- | --- |
| **R-PRG-1** | A programme's category is one of the four above. | code, `open_programme` |
| **R-PRG-2** | A kind is a short lower-case slug of letters, digits and inner hyphens, at most 64 characters, and stays the same across every version. | code, `is_slug` |
| **R-PRG-3** | A version carries 1 to 8 criteria, none of them blank. | code, `_vet_terms` |
| **R-PRG-4** | The evidence window runs from 1 hour to 30 days; the appeal window from 1 hour to 14 days. | code, `_vet_terms` |
| **R-PRG-5** | The benefit and the claimant bond are both above zero. | code, `_vet_terms` |
| **R-PRG-6** | A programme is opened in one payable call and the attached value funds its reserve. A refused call writes nothing, so the value stays with the sender. | code, `open_programme` |
| **R-PRG-7** | Versions are immutable. Publishing the next one keeps the category and the kind, writes a new version record, and edits nothing already published. | code, `publish_version` |
| **R-PRG-8** | Pausing stops new filings and nothing else. Every filing already on foot keeps all of its moves. | code, `set_paused`, `lodge` |
| **R-PRG-9** | Idle reserve — balance less committed — is drawable by the sponsor at any time. Committed money is not idle, whatever the balance says. | code, `draw_idle_reserve` |
| **R-PRG-10** | A programme may name an assessor, who is never the sponsor. | code, `open_programme` |
| **R-PRG-11** | A version asks for at least as many scene photographs as it has required views, and at least one. | code, `_vet_terms` |

A version records: definition, exclusions, criteria, minimum scene
photographs, required views, whether a document is required and of what kind,
the benefit, the bond, and both windows. A programme records: sponsor,
category, kind, optional assessor, current version, paused, and the reserve as
balance, committed and paid.

---

## R-FIL — filings

| rule | statement | enforced |
| --- | --- | --- |
| **R-FIL-1** | A filing is lodged under the version in force, on a programme that is not paused. | code, `lodge` |
| **R-FIL-2** | The bond posted is exactly the bound version's bond. Not at least it. | code, `lodge` |
| **R-FIL-3** | The reserve must cover the award. The award is committed out of idle reserve at the moment of lodging, and a reserve that cannot cover it refuses with a readable reason and commits nothing. | code, `lodge` |
| **R-FIL-4** | Two filings never share one award, because each commits its own. | code, `lodge` |
| **R-FIL-5** | One account carries at most three live filings under one programme. Live means OPEN, DETERMINED or UNDER_APPEAL. | code, `lodge`, `_settle` |
| **R-FIL-6** | A filing binds the version it was lodged under and keeps it for life. Publishing a new version moves nothing. | code, `Filing.version` |
| **R-FIL-7** | The state machine, below. | code, every lifecycle call |
| **R-FIL-8** | Damage must name a cause. Only a business-interruption programme accepts the declared cause `unstated`. | code, `lodge` |
| **R-FIL-9** | A filing names a subject, an identifier, and an event date that is a real calendar day. | code, `lodge` |

### The state machine (R-FIL-7)

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

* **OPEN** — the claimant attaches exhibits and asks for a panel, or withdraws
  before the evidence deadline. If nobody acts by the deadline, anyone may
  close it as lapsed.
* **DETERMINED** — the side the finding went against may appeal, once, inside
  the appeal window. An ESTABLISHED finding is appealed by the sponsor;
  anything else by the claimant. If nobody appeals, anyone may seal it once the
  window has passed.
* **UNDER_APPEAL** — both sides may add up to four exhibits each during a fixed
  two-day evidence period, and nothing closes the appeal while that period
  runs: the appellant was given it and does not lose it to whoever calls
  first. Once it has shut, anyone may ask for a rehearing, but only if the
  appellant itself filed something new. If the appellant filed nothing new,
  anyone may close at once — there is nothing a second panel could read, so
  the rehearing grace would be three days spent on nobody. If it did bring
  something new, the appeal may be closed on the same basis once the
  three-day rehearing grace has passed.
* **FINAL**, **WITHDRAWN**, **CLOSED** — terminal. Credits sit in a pull ledger
  until the owner withdraws.

The appeal evidence period (2 days) and the rehearing grace (3 days) are fixed
in the contract, not set per programme.

---

## R-EXH — exhibits

| rule | statement | enforced |
| --- | --- | --- |
| **R-EXH-1** | What an exhibit is, is read off its bytes. A scene photograph is a PNG carrying the full eight-byte signature, or a JPEG carrying a JFIF header at offset six. Everything else is paperwork — a sharp photograph of a bill of lading included, and an Exif JPEG included. The bytes are read again when the panel sits, so no later edit can turn paperwork into a frame. | code, `sniff_media`, `_bundle` |
| **R-EXH-2** | The same bytes cannot be attached twice to one filing. The same bytes on a different filing are fine. | code, `attach_exhibit` |
| **R-EXH-3** | A view label, and a document kind, are the filer's claim. The panel reports what a frame actually reads as beside what the filer called it, so a label the picture does not bear out counts against the filer. A label is never an instruction to the model. | code and panel |
| **R-EXH-4** | The sponsor's scene photographs exist only on the sponsor's own appeal. Sponsor paperwork is admissible on either side's appeal. | code, `_admit_exhibit` |
| **R-EXH-5** | An appeal must bring something new from the appellant before it can be reheard. | code, `_appellant_brought_new` |
| **R-EXH-6** | A linked document is fetched once, inside the panel, to a bounded 4096-byte head. Those bytes and their sha256 are what the file then carries, and every later round reads them from storage rather than going back to the web. Two nodes that pulled different bytes have not read the same file and do not record the same finding. | panel, `_hold_panel`, `rounds_agree` |
| **R-EXH-7** | A linked document whose fetched digest duplicates an exhibit already on the filing is read and then set aside. | panel |
| **R-EXH-8** | Party text, and text read off an image, are content. Both reach a prompt inside a fence, and fence markers written into party text are broken with an interpunct so a filer cannot end their own fence. | code, `fence`, `scrub_fence` |
| **R-EXH-9** | An exhibit of no bytes is not an exhibit; a scene photograph carries one of the three views; a document says what it is. | code, `attach_exhibit` |

Every exhibit records: whose it is, whether it is a frame or paper, its media,
its labels, its sha256, its size, whether it was new on appeal, and when it was
filed.

---

## Preflight — what is checked before any validator is asked

If preflight fails, no model is called. The refusal names the code and what is
actually missing. `panel_preflight` is the same code read as a view, so the app
can put the complaint beside the field that caused it without anyone spending a
transaction.

Preflight covers: the programme being open and the version bound (R-FIL-1), the
windows (R-FIL-7), the bond (R-FIL-2), the reserve commitment (R-FIL-3), the
filing cap (R-FIL-5), the required photograph count and the required views
present as labels (R-PRG-11, R-EXH-3), the required document, the image magic
bytes (R-EXH-1), duplicate hashes (R-EXH-2), an appeal having at least one new
exhibit from the appellant (R-EXH-5), a conflict note naming two exhibits on
this filing (R-GRD-5), and sponsor frames existing only on the sponsor's own
appeal (R-EXH-4).

---

## R-PNL — how the panel looks

| rule | statement |
| --- | --- |
| **R-PNL-1** | Photographs are examined two at a time, which is what `gl.nondet.exec_prompt` takes. A party's frames are examined only beside that party's own frames, never beside the other side's, so one side cannot caption the other's picture. |
| **R-PNL-2** | The photograph comes first and the claim comes second. Each node takes its sightings from a prompt that carries no claim text at all, then rates the requirements on those sightings. |
| **R-PNL-3** | A photograph a node cannot see counts for nothing for that node. Every node reports which photographs it saw. |
| **R-PNL-4** | A leader that omits a photograph a validator saw is rejected. A validator that saw fewer judges from what it saw. |
| **R-PNL-5** | A round where no node saw a scene photograph, and no assessor observation stands beside it, records nothing: the call is reverted and the filing does not move. |
| **R-PNL-6** | Cause is in scope unless the filing's declared cause is `unstated`, which only a business-interruption programme accepts. Decided in code from the file. |
| **R-PNL-7** | Papers is in scope only when the file carries at least one paper exhibit. Decided in code from the file. |

Requirements in scope, rated one at a time:

* every criterion of the bound version, as `criterion:0` … `criterion:7`
* `subject` — nothing in the evidence shows a different property, vehicle,
  consignment or premises from the one named. **Always in scope.**
* `cause` — the damage or disruption shown is consistent with the declared
  cause: water not fire, collision not wear, idling not an empty berth, drought
  not flood.
* `papers` — the filed documents agree with the photographs.

Ratings are `SATISFIED`, `NOT_SATISFIED`, `NOT_ESTABLISHED`. A requirement that
is out of scope is `NOT_APPLICABLE`, decided in code; a requirement that **is**
in scope cannot come back not applicable.

---

## R-GRD — grounding, applied in code

The grounding runs in code on whatever a node answered, and every validator
runs it again over the same stored bytes. A rating that cannot be grounded is
not discarded: it becomes `NOT_ESTABLISHED`, and R-OUT-3 turns that into
UNDETERMINED rather than into a loss for anyone.

| rule | statement |
| --- | --- |
| **R-GRD-1** | A rating stands only on a scene photograph that node saw, or on the assessor's observation. |
| **R-GRD-2** | Paperwork cannot ground SATISFIED or NOT_SATISFIED. A paper id never enters a node's sightings, so it can never reach a ground. |
| **R-GRD-3** | Sponsor photographs can ground NOT_SATISFIED only beside a claimant scene photograph, an assessor's scene photograph, or the assessor's observation. The sponsor cannot sink a filing on the sponsor's frames alone. |
| **R-GRD-4** | Where the programme has an accepted assessor observation, the claimant's photographs can ground SATISFIED on a criterion only beside that observation. |
| **R-GRD-5** | A conflict flag counts only when it names two distinct exhibits on this filing. A photograph that merely contradicts the claimant's account fails a requirement; it is not a conflict. |
| **R-GRD-6** | A NOT_SATISFIED stands only if the evidence was also enough to decide. |

---

## R-OUT — the fixed outcome rule

Pure code. The same ratings always give the same outcome, and the record says
which clause gave it. Mirrored in `web/lib/outcome.ts` and held to the same
table by both test suites.

| rule | when | outcome |
| --- | --- | --- |
| **R-OUT-1** | the evidence conflicted, or was not enough to decide | `UNDETERMINED` |
| **R-OUT-2** | any requirement `NOT_SATISFIED` | `NOT_ESTABLISHED` |
| **R-OUT-3** | any requirement `NOT_ESTABLISHED` | `UNDETERMINED` |
| **R-OUT-4** | otherwise | `ESTABLISHED` |

The order is the rule. A failed requirement outranks an open one, so a file that
was read and found wanting is a loss rather than a doubt.

---

## R-EQV — equivalence

Assessment and rehearing are the only nondeterministic writes. Both use
`gl.vm.run_nondet_unsafe` with a validator that re-reads the stored bytes,
re-takes its own sightings, and accepts the leader only if it would record the
same outcome and the same failed requirements. Nothing is compared with
`strict_eq` on free-text model output, and only the accepted structured result
is stored.

| rule | statement |
| --- | --- |
| **R-EQV-1** | An established result must be the validator's own result. Doubt stands unless the validator would establish. |
| **R-EQV-2** | A rejection must be reproduced on each requirement it fails. |
| **R-EQV-3** | The record states which ratings were bound, in record order. |
| **R-EQV-4** | A leader cannot send an answer that reads as doubt to validators and as established on the record, or the reverse: the record is re-derived from the ratings it ships with, and a record that does not follow from them is rejected. |
| **R-EQV-5** | A record missing any of its structural fields is rejected, so the writer never guesses a key. |

What a validator compares: the sightings it took against the leader's
(R-PNL-4), the outcome, the rule id, the failed requirements, the bound
ratings, blindness, and the digest of every document the panel fetched. What it
never compares: anything a model wrote in prose.

---

## R-MON — money

See `docs/money.md` for the worked arithmetic. In short:

| rule | when | what moves |
| --- | --- | --- |
| **R-MON-1** | ESTABLISHED, once final | benefit and bond credited to the claimant; benefit leaves the reserve |
| **R-MON-2** | NOT_ESTABLISHED, once final | bond joins the sponsor's reserve; benefit uncommitted back to it |
| **R-MON-3** | UNDETERMINED, once final | bond credited back to the claimant; benefit back to the reserve |
| **R-MON-4** | WITHDRAWN before the evidence deadline | bond credited back; benefit back to the reserve |
| **R-MON-5** | CLOSED after the evidence deadline with no panel | bond forfeited to the reserve; benefit back to it |
| **R-MON-6** | always | pull ledger only. Nothing is pushed. Settlement credits; the owner collects with `withdraw`. |

Sealing is one atomic write: the state, the outcome, the reserve and the ledger
move together or not at all, and a filing that has settled cannot settle again.

---

## R-REC — the receipt

**R-REC-1** — `receipt(filing_id)` returns one shape for every category:
programme id, version, category, kind, subject, identifier, event date, state,
outcome, whether it is final, the number of rounds held, the exhibit snapshot
with every hash, and the rule id of the outcome.

The receipt states the version that bound the filing, which is not necessarily
the version in force now.

---

## Which test holds which rule

| test | rules |
| --- | --- |
| `tests/test_media.py` | R-EXH-1 |
| `tests/test_outcome.py` | R-OUT-1..4, R-PNL-6, R-PNL-7 |
| `tests/test_grounding.py` | R-GRD-1..6, R-PNL-3, R-PNL-5 |
| `tests/test_equivalence.py` | R-EQV-1..5, R-PNL-4, R-EXH-6 |
| `tests/test_programme.py` | R-PRG-1..11 |
| `tests/test_filing.py` | R-FIL-1..9, R-MON-4, R-MON-5 |
| `tests/test_exhibits.py` | R-EXH-2..9, preflight, R-PRG-10 |
| `tests/test_panel.py` | R-PNL-1..7, R-EXH-6, R-GRD-4 |
| `tests/test_appeal.py` | R-FIL-7, R-EXH-4, R-EXH-5, R-GRD-5 |
| `tests/test_money.py` | R-MON-1..6 |
| `tests/test_receipt.py` | R-REC-1, R-FIL-6 |
| `web/tests/outcome.test.ts` | R-OUT-1..4 mirrored |
| `web/tests/validation.test.ts` | R-PRG, R-FIL, R-EXH-1 mirrored |
