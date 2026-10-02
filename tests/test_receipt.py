"""One receipt shape for every category. R-REC-1."""

from helpers import BYSTANDER, CLAIMANT, DAY, SPONSOR, Script, met, png, jpeg

FIELDS = {
    "filing",
    "programme",
    "version",
    "category",
    "kind",
    "subject",
    "identifier",
    "event_date",
    "state",
    "outcome",
    "rule",
    "final",
    "terminal",
    "rounds",
    "exhibits",
    "tagline",
}


def run_one(court, ep, category, kind, cause):
    pid = court.open_programme(category=category, kind=kind)
    fid = court.lodge(programme_id=pid, declared_cause=cause)
    court.stock_file(fid)
    scope = ["criterion:0", "criterion:1", "subject"]
    if cause != "unstated":
        scope.append("cause")
    Script(ratings=met(*scope, grounds=("0", "1"))).install()
    court.send("convene", fid, sender=CLAIMANT)
    court.tick(3 * DAY + 1)
    court.send("seal", fid, sender=BYSTANDER)
    return court.read("receipt", fid)


def test_the_receipt_states_the_version_that_bound_the_filing(court, ep):
    court.open_programme()
    court.lodge()
    court.send(
        "publish_version", 0, "new definition", "", ["one"], 1, [], False, "",
        1, 1, DAY, DAY, sender=SPONSOR,
    )
    receipt = court.read("receipt", 0)
    assert receipt["version"] == "1"
    assert court.read("programme", 0)["current_version"] == "2"


def test_the_receipt_carries_the_outcome_and_its_rule(court, ep):
    receipt = run_one(court, ep, ep.CAT_PROPERTY, "gala-venue-water", "storm water")
    assert receipt["outcome"] == "ESTABLISHED"
    assert receipt["rule"] == "R-OUT-4"
    assert receipt["final"] is True
    assert receipt["terminal"] is True
    assert receipt["rounds"] == "1"


def test_the_receipt_carries_the_snapshot_hashes(court, ep):
    receipt = run_one(court, ep, ep.CAT_CARGO, "berth-idling", "cargo shift at berth")
    assert [row["exhibit"] for row in receipt["exhibits"]] == ["0", "1"]
    assert all(len(row["sha256"]) == 64 for row in receipt["exhibits"])
    assert receipt["exhibits"][0]["sha256"] == ep.sha256_hex(png(b"wide"))
    assert receipt["exhibits"][1]["sha256"] == ep.sha256_hex(jpeg(b"detail"))


def test_one_shape_for_every_category(court, ep):
    shapes = []
    for category, kind, cause in (
        (ep.CAT_PROPERTY, "storm-parcel", "storm surge"),
        (ep.CAT_VEHICLE, "stage-truck-collision", "collision in the yard"),
        (ep.CAT_CARGO, "container-wetting", "sea water through a split seal"),
        (ep.CAT_INTERRUPTION, "berth-idling", "unstated"),
    ):
        receipt = run_one(court, ep, category, kind, cause)
        assert set(receipt.keys()) == FIELDS
        shapes.append(set(receipt.keys()))
    assert all(shape == shapes[0] for shape in shapes)


def test_a_receipt_exists_before_any_panel_sits(court, ep):
    court.open_programme()
    court.lodge()
    receipt = court.read("receipt", 0)
    assert set(receipt.keys()) == FIELDS
    assert receipt["state"] == "OPEN"
    assert receipt["outcome"] == ""
    assert receipt["rule"] == ""
    assert receipt["final"] is False
    assert receipt["terminal"] is False
    assert receipt["exhibits"] == []


def test_the_receipt_carries_the_tagline(court, ep):
    court.open_programme()
    court.lodge()
    assert court.read("receipt", 0)["tagline"] == court.read("tagline")
    assert "no single party reads it" in court.read("tagline")
