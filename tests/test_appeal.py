"""Appeal, rehearing and sealing. R-FIL-7, R-EXH-5."""

import pytest
from helpers import (
    AWARD,
    BYSTANDER,
    CLAIMANT,
    DAY,
    SPONSOR,
    STAKE,
    Script,
    jpeg,
    met,
    png,
)

SCOPE = ("criterion:0", "criterion:1", "subject", "cause")


def determined(court, ep, outcome="ESTABLISHED"):
    court.open_programme()
    court.lodge()
    court.stock_file(0)
    if outcome == "ESTABLISHED":
        Script(ratings=met(*SCOPE, grounds=("0", "1"))).install()
    else:
        ratings = met("criterion:1", "subject", "cause", grounds=("0", "1"))
        ratings["criterion:0"] = {"rating": "NOT_SATISFIED", "grounds": ["0"]}
        Script(ratings=ratings).install()
    got = court.send("convene", 0, sender=CLAIMANT)
    assert got == outcome
    return got


def test_an_established_finding_is_appealed_by_the_sponsor(court, ep):
    determined(court, ep, "ESTABLISHED")
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("appeal", 0, "wrong hall", [], sender=CLAIMANT)
    assert ep.E_NOT_PARTY in str(bad.value)
    assert court.send("appeal", 0, "wrong hall", [], sender=SPONSOR) == "UNDER_APPEAL"
    filing = court.read("filing", 0)
    assert filing["appellant"].lower() == SPONSOR
    assert filing["appealed_outcome"] == "ESTABLISHED"


def test_a_finding_against_the_claimant_is_appealed_by_the_claimant(court, ep):
    determined(court, ep, "NOT_ESTABLISHED")
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("appeal", 0, "it is plainly there", [], sender=SPONSOR)
    assert ep.E_NOT_PARTY in str(bad.value)
    assert court.send("appeal", 0, "it is plainly there", [], sender=CLAIMANT) == (
        "UNDER_APPEAL"
    )


def test_a_finding_is_appealed_once(court, ep):
    determined(court, ep)
    court.send("appeal", 0, "wrong hall", [], sender=SPONSOR)
    court.tick(ep.APPEAL_EVIDENCE_PERIOD + 1)
    court.send("close_appeal", 0, sender=BYSTANDER)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("appeal", 0, "again", [], sender=SPONSOR)
    assert ep.E_STATE in str(bad.value)


def test_an_appeal_after_the_window_is_refused(court, ep):
    determined(court, ep)
    court.tick(3 * DAY + 1)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("appeal", 0, "wrong hall", [], sender=SPONSOR)
    assert ep.E_APPEAL_SHUT in str(bad.value)


def test_a_conflict_note_must_name_two_exhibits_on_this_filing(court, ep):
    determined(court, ep)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("appeal", 0, "these cannot both be true", ["0"], sender=SPONSOR)
    assert ep.E_CONFLICT_THIN in str(bad.value)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("appeal", 0, "these cannot both be true", ["0", "7"], sender=SPONSOR)
    assert ep.E_CONFLICT_THIN in str(bad.value)
    assert "1 of 2 named are on filing 0" in str(bad.value)
    court.send("appeal", 0, "these cannot both be true", ["0", "1"], sender=SPONSOR)
    assert court.read("filing", 0)["state"] == "UNDER_APPEAL"


def test_an_appeal_with_no_ground_is_refused(court, ep):
    determined(court, ep)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("appeal", 0, "   ", [], sender=SPONSOR)
    assert ep.E_EMPTY in str(bad.value)


def test_the_sponsor_may_put_frames_on_the_sponsors_own_appeal(court, ep):
    determined(court, ep)
    court.send("appeal", 0, "wrong hall", [], sender=SPONSOR)
    court.attach(0, png(b"sponsor"), "wide", sender=SPONSOR)
    row = court.read("exhibit_index", 0)[2]
    assert row["party"] == "sponsor"
    assert row["new_on_appeal"] is True


def test_the_sponsor_may_not_put_frames_on_the_claimants_appeal(court, ep):
    # R-EXH-4.
    determined(court, ep, "NOT_ESTABLISHED")
    court.send("appeal", 0, "it is plainly there", [], sender=CLAIMANT)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.attach(0, png(b"sponsor"), "wide", sender=SPONSOR)
    assert ep.E_SPONSOR_FRAMES in str(bad.value)
    # Paperwork from the sponsor is still welcome on it.
    court.send(
        "attach_exhibit", 0, __import__("helpers").pdf(b"survey"), "", "survey", "",
        sender=SPONSOR,
    )
    assert court.read("exhibit_index", 0)[2]["party"] == "sponsor"


def test_each_side_is_bounded_on_appeal(court, ep):
    determined(court, ep)
    court.send("appeal", 0, "wrong hall", [], sender=SPONSOR)
    for n in range(ep.APPEAL_EXHIBITS_PER_PARTY):
        court.attach(0, png(bytes([65 + n])), "wide", sender=SPONSOR)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.attach(0, png(b"one too many"), "wide", sender=SPONSOR)
    assert ep.E_APPEAL_EXHIBIT_CAP in str(bad.value)
    # The other side still has its own allowance.
    court.attach(0, png(b"claimant reply"), "wide", sender=CLAIMANT)


def test_an_appeal_that_brought_nothing_new_cannot_be_reheard(court, ep):
    # R-EXH-5. The required test.
    determined(court, ep)
    court.send("appeal", 0, "wrong hall", [], sender=SPONSOR)
    court.tick(ep.APPEAL_EVIDENCE_PERIOD + 1)
    short = court.read("panel_preflight", 0)
    assert short["code"] == ep.E_NOTHING_NEW
    Script(ratings=met(*SCOPE, grounds=("0", "1"))).install()
    ep.gl.nondet.calls.clear()  # the first panel's calls, not this one's
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("rehear", 0, sender=BYSTANDER)
    assert ep.E_NOTHING_NEW in str(bad.value)
    assert ep.gl.nondet.calls == []


def test_an_appeal_that_brought_nothing_new_closes_at_once(court, ep):
    determined(court, ep)
    court.send("appeal", 0, "wrong hall", [], sender=SPONSOR)
    # No waiting: there is nothing a second panel could read.
    assert court.send("close_appeal", 0, sender=BYSTANDER) == "ESTABLISHED"
    filing = court.read("filing", 0)
    assert filing["state"] == "FINAL"
    assert filing["outcome"] == "ESTABLISHED"
    assert court.read("credit_of", CLAIMANT) == str(AWARD + STAKE)


def test_an_appeal_that_brought_something_new_waits_out_the_grace(court, ep):
    determined(court, ep)
    court.send("appeal", 0, "wrong hall", [], sender=SPONSOR)
    court.attach(0, png(b"sponsor"), "wide", sender=SPONSOR)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("close_appeal", 0, sender=BYSTANDER)
    assert ep.E_REHEARING_EARLY in str(bad.value)
    court.tick(ep.APPEAL_EVIDENCE_PERIOD + ep.REHEARING_GRACE + 1)
    assert court.send("close_appeal", 0, sender=BYSTANDER) == "ESTABLISHED"


def test_a_rehearing_waits_for_the_evidence_period_to_shut(court, ep):
    determined(court, ep)
    court.send("appeal", 0, "wrong hall", [], sender=SPONSOR)
    court.attach(0, png(b"sponsor"), "wide", sender=SPONSOR)
    short = court.read("panel_preflight", 0)
    assert short["code"] == ep.E_APPEAL_EVIDENCE_OPEN
    Script(ratings=met(*SCOPE, grounds=("0", "1"))).install()
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("rehear", 0, sender=BYSTANDER)
    assert ep.E_APPEAL_EVIDENCE_OPEN in str(bad.value)


def test_a_rehearing_replaces_the_finding_and_is_final(court, ep):
    determined(court, ep)
    court.send("appeal", 0, "that floor is another hall", [], sender=SPONSOR)
    court.attach(0, png(b"sponsor-wide"), "wide", sender=SPONSOR)
    court.tick(ep.APPEAL_EVIDENCE_PERIOD + 1)
    ratings = met("criterion:0", "criterion:1", "cause", grounds=("0", "1"))
    ratings["subject"] = {"rating": "NOT_SATISFIED", "grounds": ["2", "0"]}
    Script(ratings=ratings).install()
    assert court.send("rehear", 0, sender=BYSTANDER) == "NOT_ESTABLISHED"
    filing = court.read("filing", 0)
    assert filing["state"] == "FINAL"
    assert filing["outcome"] == "NOT_ESTABLISHED"
    assert filing["rounds"] == "2"
    assert court.read("round_record", 0, 1)["on_appeal"] is True
    # The bond went to the reserve, not to the claimant. R-MON-2.
    assert court.read("credit_of", CLAIMANT) == "0"


def test_an_unappealed_finding_is_sealed_by_anyone_after_the_window(court, ep):
    determined(court, ep)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("seal", 0, sender=BYSTANDER)
    assert ep.E_APPEAL_OPEN in str(bad.value)
    court.tick(3 * DAY + 1)
    assert court.send("seal", 0, sender=BYSTANDER) == "ESTABLISHED"
    assert court.read("filing", 0)["state"] == "FINAL"


def test_a_sealed_finding_is_terminal(court, ep):
    determined(court, ep)
    court.tick(3 * DAY + 1)
    court.send("seal", 0, sender=BYSTANDER)
    for move, args in (
        ("appeal", (0, "late", [])),
        ("seal", (0,)),
        ("retract", (0,)),
        ("close_lapsed", (0,)),
        ("close_appeal", (0,)),
        ("rehear", (0,)),
    ):
        with pytest.raises(ep.gl.vm.UserError):
            court.send(move, *args, sender=CLAIMANT)
