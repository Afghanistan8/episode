"""The panel: how it looks, what it is shown, and what it records."""

import json

import pytest
from helpers import (
    ASSESSOR,
    AWARD,
    BYSTANDER,
    CLAIMANT,
    DAY,
    RESERVE,
    SPONSOR,
    STAKE,
    Script,
    jpeg,
    met,
    pdf,
    png,
    sheet,
)

DEFAULT_SCOPE = ("criterion:0", "criterion:1", "subject", "cause")


def establish(grounds=("0", "1")):
    return Script(ratings=met(*DEFAULT_SCOPE, grounds=grounds)).install()


def test_a_complete_file_establishes(court, ep):
    court.open_programme()
    court.lodge()
    court.stock_file(0)
    establish()
    assert court.send("convene", 0, sender=CLAIMANT) == "ESTABLISHED"
    filing = court.read("filing", 0)
    assert filing["state"] == "DETERMINED"
    assert filing["outcome"] == "ESTABLISHED"
    assert filing["rule"] == "R-OUT-4"


def test_the_round_record_keeps_ids_and_ratings_and_no_prose(court, ep):
    court.open_programme()
    court.lodge()
    court.stock_file(0)
    establish()
    court.send("convene", 0, sender=CLAIMANT)
    held = court.read("round_record", 0, 0)
    assert held["outcome"] == "ESTABLISHED"
    assert held["on_appeal"] is False
    record = held["record"]
    assert record["seen"] == ["0", "1"]
    assert record["scope"] == list(DEFAULT_SCOPE)
    assert record["bound"] == list(DEFAULT_SCOPE)
    assert record["failed"] == []
    assert record["grounds"]["subject"] == ["0", "1"]
    # Nothing in the stored record is free text: every value is an id, a
    # rating, a flag or a rule.
    flat = json.dumps(record)
    assert "flooded hall floor" not in flat
    assert "tide line" not in flat


def test_the_snapshot_records_every_exhibit_hash(court, ep):
    court.open_programme()
    court.lodge()
    court.stock_file(0)
    court.attach(0, pdf(b"note"), "", "adjuster note", "")
    Script(
        ratings=met("criterion:0", "criterion:1", "subject", "cause", "papers",
                    grounds=("0", "1"))
    ).install()
    court.send("convene", 0, sender=CLAIMANT)
    snapshot = court.read("round_record", 0, 0)["snapshot"]
    assert [row["exhibit"] for row in snapshot] == ["0", "1", "2"]
    assert [row["kind"] for row in snapshot] == ["frame", "frame", "paper"]
    assert all(len(row["sha256"]) == 64 for row in snapshot)
    assert all(row["party"] == "claimant" for row in snapshot)
    assert all(row["new_on_appeal"] is False for row in snapshot)


def test_a_short_file_never_reaches_a_validator(court, ep):
    court.open_programme()
    court.lodge()
    court.attach(0, png(b"only one"), "wide")
    establish()
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("convene", 0, sender=CLAIMANT)
    assert ep.E_FRAMES_SHORT in str(bad.value)
    assert ep.gl.nondet.calls == []


def test_only_the_claimant_asks_for_a_panel(court, ep):
    court.open_programme()
    court.lodge()
    court.stock_file(0)
    establish()
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("convene", 0, sender=SPONSOR)
    assert ep.E_NOT_CLAIMANT in str(bad.value)
    assert ep.gl.nondet.calls == []


def test_frames_are_examined_two_at_a_time(court, ep):
    court.open_programme(min_frames=3, required_views=["wide", "detail"])
    court.lodge()
    court.attach(0, png(b"a"), "wide")
    court.attach(0, png(b"b"), "detail")
    court.attach(0, jpeg(b"c"), "detail")
    Script(ratings=met(*DEFAULT_SCOPE, grounds=("0", "1", "2"))).install()
    court.send("convene", 0, sender=CLAIMANT)
    # The leader looks, then the validator looks again over the same bytes,
    # so three frames make two calls each: a pair and a single.
    sightings = [c for c in ep.gl.nondet.calls if c["images"]]
    assert all(len(c["images"]) <= ep.FRAMES_PER_PROMPT for c in sightings)
    assert sorted(len(c["images"]) for c in sightings) == [1, 1, 2, 2]


def test_one_side_never_shares_a_call_with_the_other(court, ep):
    # R-PNL-1. The sponsor's frames arrive on the sponsor's own appeal, and
    # even then they are read beside the sponsor's frames only.
    court.open_programme()
    court.lodge()
    court.stock_file(0)
    establish()
    court.send("convene", 0, sender=CLAIMANT)
    court.send("appeal", 0, "the frames are of another hall", [], sender=SPONSOR)
    court.attach(0, png(b"sponsor-wide"), "wide", sender=SPONSOR)
    court.tick(ep.APPEAL_EVIDENCE_PERIOD + 1)
    ep.gl.nondet.calls.clear()
    Script(ratings=met(*DEFAULT_SCOPE, grounds=("0", "1"))).install()
    court.send("rehear", 0, sender=BYSTANDER)

    claimant_bytes = {png(b"wide"), jpeg(b"detail")}
    sponsor_bytes = {png(b"sponsor-wide")}
    for call in ep.gl.nondet.calls:
        if not call["images"]:
            continue
        frames = set(call["images"])
        assert len(call["images"]) <= 2
        assert not (frames & claimant_bytes and frames & sponsor_bytes)


def test_the_sighting_prompt_carries_no_claim(court, ep):
    # R-PNL-2. The photograph is looked at before the claim is read.
    court.open_programme()
    court.lodge()
    court.stock_file(0)
    script = establish()
    court.send("convene", 0, sender=CLAIMANT)
    sightings = [c["prompt"] for c in ep.gl.nondet.calls if c["images"]]
    assert sightings
    for prompt in sightings:
        assert "Thornbury Assembly Rooms" not in prompt
        assert "storm water" not in prompt
        assert "Standing water or a water line" not in prompt
        assert "Nobody has told you what is claimed" in prompt
    rating = [c["prompt"] for c in ep.gl.nondet.calls if not c["images"]][-1]
    assert "Thornbury Assembly Rooms" in rating
    assert "storm water" in rating


def test_the_rating_prompt_reports_the_label_beside_what_the_frame_is(court, ep):
    court.open_programme()
    court.lodge()
    court.stock_file(0)
    establish()
    court.send("convene", 0, sender=CLAIMANT)
    rating = [c["prompt"] for c in ep.gl.nondet.calls if not c["images"]][-1]
    assert "filer_labelled_it" in rating
    assert "actually_reads_as" in rating


def test_a_frame_nobody_could_read_counts_for_nothing(court, ep):
    # R-PNL-3. Exhibit 1 is on the file; no node could see it, so a rating
    # resting on it does not stand.
    court.open_programme()
    court.lodge()
    court.stock_file(0)
    Script(ratings=met(*DEFAULT_SCOPE, grounds=("1",)), illegible=("1",)).install()
    assert court.send("convene", 0, sender=CLAIMANT) == "UNDETERMINED"
    record = court.read("round_record", 0, 0)["record"]
    assert record["seen"] == ["0"]
    assert record["ratings"]["subject"] == "NOT_ESTABLISHED"
    assert record["rule"] == "R-OUT-3"


def test_a_round_nobody_could_see_records_nothing(court, ep):
    # R-PNL-5. The transaction is undone: no round, no finding, no state move.
    court.open_programme()
    court.lodge()
    court.stock_file(0)
    Script(ratings=met(*DEFAULT_SCOPE), illegible=("0", "1")).install()
    with pytest.raises(ep.gl.vm.UserError) as bad:
        court.send("convene", 0, sender=CLAIMANT)
    assert ep.E_PANEL_BLIND in str(bad.value)
    assert court.read("filing", 0)["state"] == "OPEN"
    assert court.read("filing", 0)["rounds"] == "0"


def test_paperwork_is_read_in_its_own_pass(court, ep):
    court.open_programme(paper_required=True, paper_kind="adjuster note")
    court.lodge()
    court.stock_file(0)
    court.attach(0, sheet("floor unusable, 2 May, J. Mellor"), "", "adjuster note", "")
    Script(
        ratings=met("criterion:0", "criterion:1", "subject", "cause", "papers",
                    grounds=("0", "1"))
    ).install()
    court.send("convene", 0, sender=CLAIMANT)
    rating = [c["prompt"] for c in ep.gl.nondet.calls if not c["images"]][-1]
    assert "PAPERWORK" in rating
    assert "floor unusable, 2 May, J. Mellor" in rating
    assert "neither prove nor disprove" in rating
    assert court.read("round_record", 0, 0)["record"]["scope"][-1] == "papers"


def test_a_photographed_document_goes_through_the_paperwork_pass(court, ep):
    court.open_programme(paper_required=True, paper_kind="lading")
    court.lodge()
    court.stock_file(0)
    court.attach(0, ep and __import__("helpers").exif_jpeg(b"lading"), "",
                 "lading", "")
    Script(
        ratings=met("criterion:0", "criterion:1", "subject", "cause", "papers",
                    grounds=("0", "1"))
    ).install()
    court.send("convene", 0, sender=CLAIMANT)
    prompts = [c["prompt"] for c in ep.gl.nondet.calls if c["images"]]
    assert any("photographed document(s)" in p for p in prompts)
    rating = [c["prompt"] for c in ep.gl.nondet.calls if not c["images"]][-1]
    assert "signed, dated, stamped" in rating


def test_a_linked_document_is_pulled_once_inside_the_panel(court, ep):
    court.open_programme(paper_required=True, paper_kind="berth log")
    court.lodge()
    court.stock_file(0)
    url = "https://registry.example.org/berth/44/log"
    ep.gl.nondet.web.pages[url] = "berth 44 idle 09:00 to 21:00, no gang assigned"
    court.send("attach_linked_paper", 0, url, "berth log", "", sender=CLAIMANT)
    Script(
        ratings=met("criterion:0", "criterion:1", "subject", "cause", "papers",
                    grounds=("0", "1"))
    ).install()
    court.send("convene", 0, sender=CLAIMANT)
    # The leader pulls it and the validator pulls it, which is how they come
    # to agree on the bytes. Each node pulls it exactly once.
    assert ep.gl.nondet.web.fetched == [url, url]
    row = court.exhibits(0)[2]
    assert len(row["sha256"]) == 64
    assert row["size"] != "0"
    body = court.read("exhibit_blob", 0, 2)
    assert body == b"berth 44 idle 09:00 to 21:00, no gang assigned"
    assert ep.sha256_hex(body) == row["sha256"]
    rating = [c["prompt"] for c in ep.gl.nondet.calls if not c["images"]][-1]
    assert "no gang assigned" in rating

    # R-EXH-6: once pulled, it is on the file. A later round reads the stored
    # bytes and never goes back to the web.
    court.send("appeal", 0, "the log is of the wrong berth", [], sender=SPONSOR)
    court.attach(0, png(b"new-on-appeal"), "identifier", sender=SPONSOR)
    court.tick(ep.APPEAL_EVIDENCE_PERIOD + 1)
    ep.gl.nondet.web.fetched.clear()
    court.send("rehear", 0, sender=BYSTANDER)
    assert ep.gl.nondet.web.fetched == []


def test_the_round_fails_when_the_validator_would_not_sign_it(court, ep):
    court.open_programme()
    court.lodge()
    court.stock_file(0)

    answers = [
        json.dumps(
            {
                "ratings": met(*DEFAULT_SCOPE, grounds=("0", "1")),
                "sufficient": True,
                "conflict": {"flag": False, "exhibits": []},
            }
        ),
        json.dumps(
            {
                "ratings": {
                    **met("criterion:1", "subject", "cause", grounds=("0", "1")),
                    "criterion:0": {"rating": "NOT_SATISFIED", "grounds": ["0"]},
                },
                "sufficient": True,
                "conflict": {"flag": False, "exhibits": []},
            }
        ),
    ]
    taken = {"n": 0}

    def split(prompt, images):
        if images:
            return Script()( prompt, images)
        answer = answers[min(taken["n"], len(answers) - 1)]
        taken["n"] += 1
        return answer

    ep.gl.nondet.answer = split
    with pytest.raises(ep.gl.vm.Rollback):
        court.send("convene", 0, sender=CLAIMANT)
    assert court.read("filing", 0)["state"] == "OPEN"


def test_an_assessor_observation_can_carry_a_round_on_its_own(court, ep):
    court.open_programme(assessor=ASSESSOR)
    court.lodge()
    court.stock_file(0)
    court.send(
        "attach_observation",
        0,
        "Attended 14:10. Water from stage to doors, two centimetres, "
        "sprung floor lifting at the joints.",
        sender=ASSESSOR,
    )
    # With an observation on the file the claimant's own frames no longer
    # carry a criterion by themselves. R-GRD-4.
    Script(ratings=met(*DEFAULT_SCOPE, grounds=("0", "1"))).install()
    assert court.send("convene", 0, sender=CLAIMANT) == "UNDETERMINED"
    record = court.read("round_record", 0, 0)["record"]
    assert record["ratings"]["criterion:0"] == "NOT_ESTABLISHED"
    assert record["ratings"]["subject"] == "SATISFIED"


def test_the_observation_beside_the_frames_establishes(court, ep):
    court.open_programme(assessor=ASSESSOR)
    court.lodge()
    court.stock_file(0)
    court.send("attach_observation", 0, "Attended. Floor under water.", sender=ASSESSOR)
    Script(ratings=met(*DEFAULT_SCOPE, grounds=("0", "1", "observation"))).install()
    assert court.send("convene", 0, sender=CLAIMANT) == "ESTABLISHED"
    rating = [c["prompt"] for c in ep.gl.nondet.calls if not c["images"]][-1]
    assert "ASSESSOR OBSERVATION" in rating


def test_an_interruption_filing_drops_cause_from_the_scope(court, ep):
    # R-PNL-6. Scope is settled in code from the file.
    court.open_programme(category=ep.CAT_INTERRUPTION, kind="berth-idling")
    court.lodge(declared_cause="unstated")
    court.stock_file(0)
    Script(
        ratings=met("criterion:0", "criterion:1", "subject", grounds=("0", "1"))
    ).install()
    assert court.send("convene", 0, sender=CLAIMANT) == "ESTABLISHED"
    record = court.read("round_record", 0, 0)["record"]
    assert record["scope"] == ["criterion:0", "criterion:1", "subject"]
    assert "cause" not in record["ratings"]
