# Episode: the money

> Did it happen? The file decides, and no single party reads it.

Nothing in Episode is ever pushed. A settlement credits a ledger; the owner
collects for themselves. The rule ids here are the ones in
[`rules.md`](./rules.md) and in `contracts/episode.py`.

All amounts are integer atomic units — wei, where 1 GEN is 10^18 wei. There is
no fixed-point arithmetic anywhere in the contract and no rounding, so nothing
is ever lost in a division.

---

## The three accounts

**The reserve** is a programme's own money, held as three numbers:

| field | meaning |
| --- | --- |
| `balance` | everything the programme holds |
| `committed` | the sum of the awards promised to live filings |
| `paid` | the running total of awards actually paid out |

Idle reserve is `balance - committed`. It is the only part the sponsor can
draw, which is the whole point of keeping the two numbers apart: an award
promised to a live filing is not the sponsor's to take back. **R-PRG-9.**

The invariant the contract holds at all times:

```
balance >= committed >= 0
```

**The bond** is the claimant's, posted with the filing as the call's attached
value and held on the filing itself until it settles.

**The ledger** is a map from address to what Episode owes it. It is the only
way money leaves. **R-MON-6.**

---

## The one write that moves money

`_settle` is called once per filing, and only once: a filing that has settled
refuses to settle again. In every branch the award comes off `committed` —
the filing is over either way — and only an established finding takes it off
`balance` as well.

```
committed -= award                      always
```

### R-MON-1 — ESTABLISHED, once final

```
ledger[claimant] += award + stake
balance          -= award
paid             += award
```

The benefit and the bond both go to the claimant. The benefit leaves the
reserve, because it has been paid.

### R-MON-2 — NOT_ESTABLISHED, once final

```
balance += stake
```

The bond joins the reserve itself, not the sponsor's ledger. It goes back to
covering awards for the next claimant, which is what a reserve is for. The
sponsor can draw it later as idle reserve if they want it out.

### R-MON-3 — UNDETERMINED, once final

```
ledger[claimant] += stake
```

Nobody carried the file, so nobody pays for it. The bond goes back and the
benefit is uncommitted. A file the panel could not read is not a loss for the
claimant.

### R-MON-4 — WITHDRAWN before the evidence deadline

```
ledger[claimant] += stake
```

Withdrawing costs nothing. A claimant who files and then finds their own
evidence will not do should be able to stop.

### R-MON-5 — CLOSED after the evidence deadline with no panel

```
balance += stake
```

The bond is forfeited to the reserve. This is the only branch where the
claimant loses the bond without a finding, and it is the branch that makes the
bond do its job: an abandoned filing holds an award out of a reserve other
claimants could be filing against. Anyone may close a lapsed filing, so
unsticking one is not a favour anybody has to ask for.

---

## Collecting

```
withdraw()
```

Pays the caller whatever the ledger owes them, and zeroes it. The payout leaves
through a declared wallet interface (`@gl.evm.contract_interface`), which emits
a chain-layer send: an internal dispatch to an address with no code is not a
payment, so Episode does not use one.

A drawn idle reserve is collected the same way. `draw_idle_reserve` moves the
amount out of `balance` and into the sponsor's ledger; `withdraw` pays it.

---

## Worked example

A gala venue programme: benefit 100 GEN, bond 5 GEN, reserve funded with 500
GEN.

| step | balance | committed | idle | ledger(claimant) | ledger(sponsor) |
| --- | --- | --- | --- | --- | --- |
| opened and funded | 500 | 0 | 500 | 0 | 0 |
| filing A lodged | 500 | 100 | 400 | 0 | 0 |
| filing B lodged | 500 | 200 | 300 | 0 | 0 |
| filing C lodged | 500 | 300 | 200 | 0 | 0 |
| A sealed ESTABLISHED | 400 | 200 | 200 | 105 | 0 |
| B sealed NOT_ESTABLISHED | 405 | 100 | 305 | 105 | 0 |
| C lapsed and closed | 410 | 0 | 410 | 105 | 0 |
| sponsor draws 400 | 10 | 0 | 10 | 105 | 400 |
| both withdraw | 10 | 0 | 10 | 0 | 0 |

The bonds posted were 15 GEN in total. 5 went back to the claimant with A's
benefit, 5 joined the reserve on B, and 5 was forfeited to it on C. Nothing
was created and nothing vanished:

```
500 funded + 15 bonded  =  10 left in the reserve + 105 + 400 collected
```

`tests/test_money.py::test_the_books_balance_across_every_outcome` holds that
identity across all three findings, and
`test_the_reserve_never_goes_below_what_it_owes` holds the invariant across
every settlement path.

---

## What cannot happen

* **Two filings promised the same award.** The award is committed at lodging,
  out of idle reserve, so a reserve that cannot cover one more refuses the
  filing with the arithmetic in the refusal and commits nothing. **R-FIL-3,
  R-FIL-4.**
* **A sponsor withdrawing money a claimant is owed.** Committed is not idle.
  **R-PRG-9.**
* **A bond paid twice, or an award paid twice.** `settled` is checked and set in
  the same write. **R-MON-6.**
* **A partial settlement.** The state, the outcome, the reserve and the ledger
  all move in one call, or the call reverts and none of them do.
* **A push payment to an address that cannot receive it.** There are none.
  Everything is a pull. **R-MON-6.**
