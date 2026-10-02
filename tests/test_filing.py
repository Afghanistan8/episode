"""Lodging, the cap, the version pin and the state machine. R-FIL-1..7."""

import pytest
from helpers import (
    AWARD,
    BYSTANDER,
    CLAIMANT,
    DAY,
    OTHER_CLAIMANT,
    RESERVE,
    SPONSOR,
    STAKE,
    jpeg,
    png,
)


def test_lodging_commits_the_award_and_holds_the_bond(court, ep):
    court.open_programme()
    fid = court.lodge()
    assert fid == 0
    filing = court.read("filing", 0)
    assert filing["state"] == "OPEN"
    assert filing["stake_held"] == str(STAKE)
    assert filing["award_held"] == str(AWARD)
    assert filing["version"] == "1"
    assert court.read("programme", 0)["committed"] == str(AWARD)


def test_a_bond_that_is_not_the_bond_is_refused(court, ep):
    court.open_programme()
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.lodge(value=STAKE - 1)
    assert ep.E_STAKE_MISMATCH in str(bad.value)
    assert str(STAKE) in str(bad.value)
    assert court.read("filing_count") == 0


def test_a_reserve_that_cannot_cover_the_award_refuses_and_commits_nothing(court, ep):
    # The required refusal: readable, and nothing moves.
    court.open_programme(reserve=AWARD + 1)
    court.lodge()
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.lodge()
    message = str(bad.value)
    assert ep.E_RESERVE_SHORT in message
    assert "the reserve cannot cover this award" in message
    assert "nothing was committed" in message
    held = court.read("programme", 0)
    assert held["committed"] == str(AWARD)  # still just the one filing
    assert court.read("filing_count") == 1


def test_a_stale_version_is_refused_with_the_one_in_force(court, ep):
    court.open_programme()
    court.send(
        "publish_version", 0, "d", "e", ["c"], 2, ["wide", "detail"], False, "",
        AWARD, STAKE, 7 * DAY, 3 * DAY, sender=SPONSOR,
    )
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.lodge(version=1)
    assert ep.E_VERSION_STALE in str(bad.value)
    assert "version 2 is in force" in str(bad.value)


def test_a_filing_keeps_the_version_it_was_lodged_under(court, ep):
    # R-FIL-6. The required version-pin test.
    court.open_programme()
    fid = court.lodge()
    assert court.read("filing", fid)["version"] == "1"
    court.send(
        "publish_version", 0, "a different definition", "e",
        ["one criterion now"], 3, ["wide", "detail", "identifier"], True,
        "adjuster note", AWARD * 3, STAKE * 5, 2 * DAY, DAY, sender=SPONSOR,
    )
    filing = court.read("filing", fid)
    assert filing["version"] == "1"
    assert filing["stake_held"] == str(STAKE)
    assert filing["award_held"] == str(AWARD)
    # And the old version still reads back exactly as it was published.
    bound = court.read("programme_version", 0, 1)
    assert bound["min_frames"] == "2"
    assert bound["required_views"] == ["wide", "detail"]
    assert bound["paper_required"] is False
    # The bound version is what the panel asks for, not the new one.
    court.stock_file(fid)
    assert court.read("panel_preflight", fid)["ok"] is True


def test_an_account_carries_at_most_three_live_filings_per_programme(court, ep):
    # R-FIL-5. The required three-open cap test.
    court.open_programme()
    for n in range(3):
        court.lodge()
    assert court.read("live_filings", 0, CLAIMANT) == "3"
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.lodge()
    assert ep.E_CAP in str(bad.value)
    assert "already carries 3" in str(bad.value)
    # Somebody else is not capped by this claimant's filings.
    assert court.lodge(sender=OTHER_CLAIMANT) == 3
    # And clearing one makes room again.
    court.send("retract", 0, sender=CLAIMANT)
    assert court.read("live_filings", 0, CLAIMANT) == "2"
    assert court.lodge() == 4


def test_the_cap_is_per_programme_not_per_account(court, ep):
    court.open_programme()
    court.open_programme(kind="berth-idling", category=ep.CAT_CARGO)
    for n in range(3):
        court.lodge(programme_id=0)
    assert court.lodge(programme_id=1) == 3


def test_a_subject_without_an_identifier_is_refused(court, ep):
    court.open_programme()
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.lodge(subject_identifier="  ")
    assert ep.E_SUBJECT in str(bad.value)
    assert "parcel id, VIN, container, berth or policy reference" in str(bad.value)


def test_a_malformed_event_date_is_refused(court, ep):
    court.open_programme()
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.lodge(event_date="last Tuesday")
    assert ep.E_EVENT_DATE in str(bad.value)


def test_damage_has_to_name_a_cause(court, ep):
    court.open_programme(category=ep.CAT_PROPERTY)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.lodge(declared_cause="unstated")
    assert ep.E_CAUSE_UNSTATED in str(bad.value)


def test_an_interruption_may_leave_the_cause_unstated(court, ep):
    court.open_programme(category=ep.CAT_INTERRUPTION, kind="berth-idling")
    fid = court.lodge(declared_cause="unstated")
    assert court.read("filing", fid)["declared_cause"] == "unstated"


def test_withdrawing_before_the_deadline_returns_the_bond_and_the_award(court, ep):
    # R-MON-4. The required withdraw test.
    court.open_programme()
    court.lodge()
    court.tick(DAY)
    assert court.send("retract", 0, sender=CLAIMANT) == "WITHDRAWN"
    filing = court.read("filing", 0)
    assert filing["state"] == "WITHDRAWN"
    assert filing["settled"] is True
    held = court.read("programme", 0)
    assert held["committed"] == "0"
    assert held["balance"] == str(RESERVE)
    assert court.read("credit_of", CLAIMANT) == str(STAKE)


def test_only_the_claimant_withdraws(court, ep):
    court.open_programme()
    court.lodge()
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("retract", 0, sender=SPONSOR)
    assert ep.E_NOT_CLAIMANT in str(bad.value)


def test_withdrawing_after_the_deadline_is_refused(court, ep):
    court.open_programme()
    court.lodge()
    court.tick(8 * DAY)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("retract", 0, sender=CLAIMANT)
    assert ep.E_EVIDENCE_SHUT in str(bad.value)
    assert "closed as lapsed instead" in str(bad.value)


def test_a_lapsed_filing_forfeits_the_bond_and_returns_the_award(court, ep):
    # R-MON-5. The required lapse test. Anyone may call it.
    court.open_programme()
    court.lodge()
    court.tick(7 * DAY + 1)
    assert court.send("close_lapsed", 0, sender=BYSTANDER) == "CLOSED"
    held = court.read("programme", 0)
    assert held["committed"] == "0"
    assert held["balance"] == str(RESERVE + STAKE)
    assert court.read("credit_of", CLAIMANT) == "0"
    assert court.read("live_filings", 0, CLAIMANT) == "0"


def test_a_filing_cannot_lapse_while_the_window_runs(court, ep):
    court.open_programme()
    court.lodge()
    court.tick(7 * DAY)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("close_lapsed", 0, sender=BYSTANDER)
    assert ep.E_EVIDENCE_OPEN in str(bad.value)


def test_a_terminal_filing_does_not_settle_twice(court, ep):
    court.open_programme()
    court.lodge()
    court.send("retract", 0, sender=CLAIMANT)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("retract", 0, sender=CLAIMANT)
    assert ep.E_STATE in str(bad.value)
    assert court.read("credit_of", CLAIMANT) == str(STAKE)


def test_two_filings_never_share_one_award(court, ep):
    # R-FIL-4. Enough reserve for two awards and not a wei more.
    court.open_programme(reserve=AWARD * 2)
    court.lodge()
    court.lodge()
    assert court.read("programme", 0)["idle"] == "0"
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.lodge()
    assert ep.E_RESERVE_SHORT in str(bad.value)
