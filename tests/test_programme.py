"""Programmes, versions and the reserve. R-PRG-1..10."""

import pytest
from helpers import ASSESSOR, AWARD, CLAIMANT, DAY, RESERVE, SPONSOR, STAKE


def refusal(ep, excinfo):
    return str(excinfo.value)


def test_opening_a_programme_funds_its_reserve(court, ep):
    pid = court.open_programme()
    assert pid == 0
    held = court.read("programme", 0)
    assert held["sponsor"].lower() == SPONSOR
    assert held["category_name"] == "property-damage"
    assert held["kind"] == "gala-venue-water"
    assert held["balance"] == str(RESERVE)
    assert held["committed"] == "0"
    assert held["idle"] == str(RESERVE)
    assert held["current_version"] == "1"


def test_the_first_version_carries_the_terms(court, ep):
    court.open_programme()
    bound = court.read("programme_version", 0, 1)
    assert bound["criteria"] == [
        "Standing water or a water line is visible on the venue floor.",
        "The floor shown cannot be walked or staged on.",
    ]
    assert bound["required_views"] == ["wide", "detail"]
    assert bound["award"] == str(AWARD)
    assert bound["stake"] == str(STAKE)


def test_a_category_outside_the_four_is_refused(court, ep):
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(category=9)
    assert ep.E_CATEGORY in str(bad.value)
    assert "got 9" in str(bad.value)


def test_a_kind_that_is_not_a_slug_is_refused(court, ep):
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(kind="Gala Venue Water")
    assert ep.E_KIND in str(bad.value)


def test_a_programme_needs_between_one_and_eight_criteria(court, ep):
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(criteria=[])
    assert ep.E_CRITERIA in str(bad.value)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(criteria=["a"] * 9, min_frames=2)
    assert ep.E_CRITERIA in str(bad.value)
    assert "got 9" in str(bad.value)


def test_a_blank_criterion_is_refused_by_index(court, ep):
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(criteria=["water is visible", "   "])
    assert ep.E_CRITERIA in str(bad.value)
    assert "criterion 1" in str(bad.value)


def test_a_view_outside_the_three_is_refused(court, ep):
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(required_views=["wide", "aerial"])
    assert ep.E_VIEW_UNKNOWN in str(bad.value)
    assert "aerial" in str(bad.value)


def test_a_programme_must_ask_for_enough_frames_to_cover_its_views(court, ep):
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(
            min_frames=1, required_views=["wide", "detail", "identifier"]
        )
    assert ep.E_FRAMES_SHORT in str(bad.value)
    assert "at least 3" in str(bad.value)


def test_windows_are_bounded_at_both_ends(court, ep):
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(evidence_window=60)
    assert ep.E_WINDOW in str(bad.value)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(evidence_window=60 * DAY)
    assert ep.E_WINDOW in str(bad.value)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(appeal_window=30 * DAY)
    assert ep.E_WINDOW in str(bad.value)


def test_an_award_or_bond_of_nothing_is_refused(court, ep):
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(award=0)
    assert ep.E_AWARD in str(bad.value)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(stake=0)
    assert ep.E_STAKE in str(bad.value)


def test_the_sponsor_cannot_be_its_own_assessor(court, ep):
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.open_programme(assessor=SPONSOR)
    assert ep.E_ASSESSOR_IS_SPONSOR in str(bad.value)


def test_a_refused_programme_is_never_written(court, ep):
    with pytest.raises(ep.gl.vm.UserError):
        court.open_programme(category=9)
    assert court.read("programme_count") == 0


def test_funding_adds_to_the_balance(court, ep):
    court.open_programme()
    court.send("fund_programme", 0, sender=SPONSOR, value=10)
    assert court.read("programme", 0)["balance"] == str(RESERVE + 10)


def test_a_new_version_keeps_the_category_and_the_kind(court, ep):
    court.open_programme()
    nxt = court.send(
        "publish_version",
        0,
        "Water reached the floor and the floor was unusable for the booking.",
        "Condensation and cleaning water.",
        ["Standing water is visible.", "The floor is unusable.", "The booking was held."],
        2,
        ["wide", "detail"],
        True,
        "booking contract",
        AWARD * 2,
        STAKE * 2,
        5 * DAY,
        2 * DAY,
        sender=SPONSOR,
    )
    assert nxt == 2
    held = court.read("programme", 0)
    assert held["current_version"] == "2"
    assert held["category_name"] == "property-damage"
    assert held["kind"] == "gala-venue-water"
    first = court.read("programme_version", 0, 1)
    second = court.read("programme_version", 0, 2)
    assert first["award"] == str(AWARD)
    assert second["award"] == str(AWARD * 2)
    assert second["paper_required"] is True
    assert len(second["criteria"]) == 3


def test_only_the_sponsor_publishes_a_version(court, ep):
    court.open_programme()
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send(
            "publish_version", 0, "d", "e", ["c"], 1, [], False, "", AWARD, STAKE,
            DAY, DAY, sender=CLAIMANT,
        )
    assert ep.E_NOT_SPONSOR in str(bad.value)


def test_only_the_sponsor_pauses_a_programme(court, ep):
    court.open_programme()
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("set_paused", 0, True, sender=CLAIMANT)
    assert ep.E_NOT_SPONSOR in str(bad.value)


def test_pausing_stops_new_filings_and_nothing_else(court, ep):
    court.open_programme()
    court.lodge()  # lodged before the pause
    court.send("set_paused", 0, True, sender=SPONSOR)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.lodge()
    assert ep.E_PAUSED in str(bad.value)
    # The filing already on foot keeps every one of its moves.
    court.stock_file(0)
    assert court.read("panel_preflight", 0)["ok"] is True
    court.send("set_paused", 0, False, sender=SPONSOR)
    court.lodge()
    assert court.read("filing_count") == 2


def test_the_sponsor_draws_idle_reserve_to_the_ledger(court, ep):
    court.open_programme()
    court.send("draw_idle_reserve", 0, 50, sender=SPONSOR)
    assert court.read("programme", 0)["balance"] == str(RESERVE - 50)
    assert court.read("credit_of", SPONSOR) == "50"


def test_committed_money_is_not_idle(court, ep):
    court.open_programme()
    court.lodge()
    held = court.read("programme", 0)
    assert held["committed"] == str(AWARD)
    assert held["idle"] == str(RESERVE - AWARD)
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("draw_idle_reserve", 0, RESERVE, sender=SPONSOR)
    assert ep.E_IDLE_SHORT in str(bad.value)
    assert "is committed to live filings" in str(bad.value)
    # Right up to the idle line is fine.
    court.send("draw_idle_reserve", 0, RESERVE - AWARD, sender=SPONSOR)
    assert court.read("programme", 0)["idle"] == "0"


def test_an_unknown_programme_is_named_in_the_refusal(court, ep):
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.read("programme", 4)
    assert ep.E_PROGRAMME in str(bad.value)
    assert "no programme 4" in str(bad.value)


def test_every_category_opens(court, ep):
    for category, kind in (
        (ep.CAT_PROPERTY, "storm-parcel"),
        (ep.CAT_VEHICLE, "stage-truck-collision"),
        (ep.CAT_CARGO, "berth-idling"),
        (ep.CAT_INTERRUPTION, "drought-stand"),
    ):
        pid = court.open_programme(category=category, kind=kind)
        assert court.read("programme", pid)["kind"] == kind
