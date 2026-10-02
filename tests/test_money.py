"""The pull ledger and the five settlements. R-MON-1..6."""

import genlayer
import pytest
from helpers import (
    AWARD,
    BYSTANDER,
    CLAIMANT,
    DAY,
    RESERVE,
    SPONSOR,
    STAKE,
    Script,
    met,
)

SCOPE = ("criterion:0", "criterion:1", "subject", "cause")


def finish(court, ep, outcome):
    court.open_programme()
    court.lodge()
    court.stock_file(0)
    ratings = met(*SCOPE, grounds=("0", "1"))
    if outcome == "NOT_ESTABLISHED":
        ratings["criterion:0"] = {"rating": "NOT_SATISFIED", "grounds": ["0"]}
        Script(ratings=ratings).install()
    elif outcome == "UNDETERMINED":
        Script(ratings=ratings, sufficient=False).install()
    else:
        Script(ratings=ratings).install()
    assert court.send("convene", 0, sender=CLAIMANT) == outcome
    court.tick(3 * DAY + 1)
    court.send("seal", 0, sender=BYSTANDER)


def test_an_established_finding_pays_the_award_and_returns_the_bond(court, ep):
    # R-MON-1.
    finish(court, ep, "ESTABLISHED")
    assert court.read("credit_of", CLAIMANT) == str(AWARD + STAKE)
    assert court.read("credit_of", SPONSOR) == "0"
    held = court.read("programme", 0)
    assert held["balance"] == str(RESERVE - AWARD)
    assert held["committed"] == "0"
    assert held["paid"] == str(AWARD)
    assert held["idle"] == str(RESERVE - AWARD)


def test_a_finding_against_the_claimant_sends_the_bond_to_the_reserve(court, ep):
    # R-MON-2. The bond joins the reserve itself, not the sponsor's ledger:
    # it goes back to covering awards.
    finish(court, ep, "NOT_ESTABLISHED")
    assert court.read("credit_of", CLAIMANT) == "0"
    assert court.read("credit_of", SPONSOR) == "0"
    held = court.read("programme", 0)
    assert held["balance"] == str(RESERVE + STAKE)
    assert held["committed"] == "0"
    assert held["paid"] == "0"
    assert held["idle"] == str(RESERVE + STAKE)


def test_an_undetermined_finding_returns_the_bond_and_the_award(court, ep):
    # R-MON-3. Nobody carried the file, so nobody pays for it.
    finish(court, ep, "UNDETERMINED")
    assert court.read("credit_of", CLAIMANT) == str(STAKE)
    held = court.read("programme", 0)
    assert held["balance"] == str(RESERVE)
    assert held["committed"] == "0"
    assert held["paid"] == "0"


def test_the_ledger_pays_the_caller_and_empties(court, ep):
    finish(court, ep, "ESTABLISHED")
    owed = AWARD + STAKE
    assert court.send("withdraw", sender=CLAIMANT) == str(owed)
    assert genlayer.transfers == [(CLAIMANT, owed)]
    assert court.read("credit_of", CLAIMANT) == "0"


def test_an_empty_ledger_is_refused_rather_than_paid(court, ep):
    court.open_programme()
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("withdraw", sender=BYSTANDER)
    assert ep.E_LEDGER_EMPTY in str(bad.value)
    assert genlayer.transfers == []


def test_nothing_is_pushed_at_settlement(court, ep):
    # R-MON-6. Sealing credits. Collecting is a separate call by the owner.
    finish(court, ep, "ESTABLISHED")
    assert genlayer.transfers == []
    court.send("withdraw", sender=CLAIMANT)
    assert len(genlayer.transfers) == 1


def test_a_drawn_reserve_is_collected_the_same_way(court, ep):
    court.open_programme()
    court.send("draw_idle_reserve", 0, 77, sender=SPONSOR)
    assert genlayer.transfers == []
    court.send("withdraw", sender=SPONSOR)
    assert genlayer.transfers == [(SPONSOR, 77)]


def test_credits_from_several_filings_accumulate(court, ep):
    court.open_programme()
    court.lodge()
    court.lodge()
    court.send("retract", 0, sender=CLAIMANT)
    court.send("retract", 1, sender=CLAIMANT)
    assert court.read("credit_of", CLAIMANT) == str(STAKE * 2)
    court.send("withdraw", sender=CLAIMANT)
    assert genlayer.transfers == [(CLAIMANT, STAKE * 2)]


def test_the_reserve_never_goes_below_what_it_owes(court, ep):
    # Every settlement path, run against one reserve, and the invariant
    # balance >= committed holds after each.
    court.open_programme(reserve=AWARD * 4)
    for n in range(3):
        court.lodge()
    held = court.read("programme", 0)
    assert int(held["balance"]) >= int(held["committed"])
    court.send("retract", 0, sender=CLAIMANT)
    court.stock_file(1)
    Script(ratings=met(*SCOPE, grounds=("0", "1"))).install()
    court.send("convene", 1, sender=CLAIMANT)
    court.tick(3 * DAY + 1)
    court.send("seal", 1, sender=BYSTANDER)
    court.tick(5 * DAY)  # past filing 2's own evidence window
    court.send("close_lapsed", 2, sender=BYSTANDER)
    held = court.read("programme", 0)
    assert held["committed"] == "0"
    assert int(held["balance"]) == AWARD * 4 - AWARD + STAKE
    assert court.read("credit_of", CLAIMANT) == str(STAKE + AWARD + STAKE)


def test_the_books_balance_across_every_outcome(court, ep):
    # What went in, through the reserve and the bonds, comes out again: the
    # reserve plus every ledger credit equals everything ever paid in.
    court.open_programme(reserve=RESERVE)
    paid_in = RESERVE
    outcomes = ("ESTABLISHED", "NOT_ESTABLISHED", "UNDETERMINED")
    for n, outcome in enumerate(outcomes):
        fid = court.lodge()
        paid_in += STAKE
        court.stock_file(fid)
        ratings = met(*SCOPE, grounds=("0", "1"))
        if outcome == "NOT_ESTABLISHED":
            ratings["criterion:0"] = {"rating": "NOT_SATISFIED", "grounds": ["0"]}
            Script(ratings=ratings).install()
        elif outcome == "UNDETERMINED":
            Script(ratings=ratings, sufficient=False).install()
        else:
            Script(ratings=ratings).install()
        assert court.send("convene", fid, sender=CLAIMANT) == outcome
        court.tick(3 * DAY + 1)
        court.send("seal", fid, sender=BYSTANDER)

    held = court.read("programme", 0)
    owed = int(court.read("credit_of", CLAIMANT)) + int(
        court.read("credit_of", SPONSOR)
    )
    assert int(held["balance"]) + owed == paid_in
    assert held["committed"] == "0"
