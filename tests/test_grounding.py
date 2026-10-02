"""Grounding, applied in code to whatever a node answered. R-GRD-1..6."""


def ctx(ep, frames=None, papers=None, observation=False, scope=None):
    frames = frames if frames is not None else {"0": ep.PARTY_CLAIMANT}
    return {
        "scope": scope or ["criterion:0", "subject"],
        "frames": frames,
        "papers": papers or {},
        "observation": observation,
    }


def answer(ratings, seen=("0",), sufficient=True, conflict=None):
    return {
        "ratings": ratings,
        "seen": list(seen),
        "sufficient": sufficient,
        "conflict": conflict or {"flag": False, "exhibits": []},
    }


def test_a_rating_on_a_frame_this_node_saw_stands(ep):
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {"rating": "SATISFIED", "grounds": ["0"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            }
        ),
        ctx(ep),
    )
    assert record["outcome"] == ep.OUT_ESTABLISHED
    assert record["bound"] == ["criterion:0", "subject"]
    assert record["failed"] == []


def test_a_rating_on_a_frame_this_node_did_not_see_does_not_stand(ep):
    # R-GRD-1. The frame is on the file; this node could not read it, so for
    # this node it carries nothing. R-PNL-3.
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {"rating": "SATISFIED", "grounds": ["0"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            },
            seen=(),
        ),
        ctx(ep),
    )
    assert record["ratings"]["criterion:0"] == ep.RATE_NOT_ESTABLISHED
    assert record["outcome"] == ep.OUT_UNDETERMINED
    assert record["blind"] is True


def test_paperwork_cannot_ground_a_scene_rating(ep):
    # R-GRD-2. Exhibit 1 is a document. Citing it grounds nothing, whatever a
    # node says about it, because a paper id never enters the sightings.
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {"rating": "SATISFIED", "grounds": ["1"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            },
            seen=("0", "1"),
        ),
        ctx(ep, frames={"0": ep.PARTY_CLAIMANT}, papers={"1": ep.PARTY_CLAIMANT}),
    )
    assert record["seen"] == ["0"]
    assert record["ratings"]["criterion:0"] == ep.RATE_NOT_ESTABLISHED
    assert record["ratings"]["subject"] == ep.RATE_SATISFIED
    assert record["outcome"] == ep.OUT_UNDETERMINED


def test_paperwork_cannot_ground_a_failure_either(ep):
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {"rating": "NOT_SATISFIED", "grounds": ["1"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            },
            seen=("0", "1"),
        ),
        ctx(ep, frames={"0": ep.PARTY_CLAIMANT}, papers={"1": ep.PARTY_SPONSOR}),
    )
    assert record["failed"] == []
    assert record["outcome"] == ep.OUT_UNDETERMINED


def test_a_sponsor_frame_alone_cannot_fail_a_requirement(ep):
    # R-GRD-3. The sponsor does not get to sink a filing on the sponsor's own
    # photographs.
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {"rating": "NOT_SATISFIED", "grounds": ["1"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            },
            seen=("0", "1"),
        ),
        ctx(ep, frames={"0": ep.PARTY_CLAIMANT, "1": ep.PARTY_SPONSOR}),
    )
    assert record["ratings"]["criterion:0"] == ep.RATE_NOT_ESTABLISHED
    assert record["failed"] == []
    assert record["outcome"] == ep.OUT_UNDETERMINED


def test_a_sponsor_frame_beside_a_claimant_frame_can_fail_a_requirement(ep):
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {"rating": "NOT_SATISFIED", "grounds": ["1", "0"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            },
            seen=("0", "1"),
        ),
        ctx(ep, frames={"0": ep.PARTY_CLAIMANT, "1": ep.PARTY_SPONSOR}),
    )
    assert record["failed"] == ["criterion:0"]
    assert record["outcome"] == ep.OUT_NOT_ESTABLISHED
    assert record["rule"] == "R-OUT-2"


def test_a_sponsor_frame_beside_the_observation_can_fail_a_requirement(ep):
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {
                    "rating": "NOT_SATISFIED",
                    "grounds": ["1", "observation"],
                },
                "subject": {"rating": "SATISFIED", "grounds": ["observation"]},
            },
            seen=("1",),
        ),
        ctx(ep, frames={"1": ep.PARTY_SPONSOR}, observation=True),
    )
    assert record["failed"] == ["criterion:0"]


def test_a_failure_does_not_stand_on_evidence_too_thin_to_decide(ep):
    # R-GRD-6. Doubt is not a loss.
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {"rating": "NOT_SATISFIED", "grounds": ["0"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            },
            sufficient=False,
        ),
        ctx(ep),
    )
    assert record["ratings"]["criterion:0"] == ep.RATE_NOT_ESTABLISHED
    assert record["outcome"] == ep.OUT_UNDETERMINED
    assert record["rule"] == "R-OUT-1"


def test_a_conflict_naming_fewer_than_two_exhibits_is_ignored(ep):
    # R-GRD-5. A photograph that merely contradicts the claimant's account is
    # a requirement not satisfied, not a conflict, and an unsupported flag
    # changes nothing.
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {"rating": "SATISFIED", "grounds": ["0"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            },
            conflict={"flag": True, "exhibits": ["0"]},
        ),
        ctx(ep),
    )
    assert record["conflict"] is False
    assert record["conflict_exhibits"] == []
    assert record["outcome"] == ep.OUT_ESTABLISHED


def test_a_conflict_naming_an_exhibit_from_elsewhere_is_ignored(ep):
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {"rating": "SATISFIED", "grounds": ["0"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            },
            conflict={"flag": True, "exhibits": ["0", "99"]},
        ),
        ctx(ep),
    )
    assert record["conflict"] is False
    assert record["outcome"] == ep.OUT_ESTABLISHED


def test_a_conflict_naming_two_exhibits_on_this_filing_counts(ep):
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {"rating": "SATISFIED", "grounds": ["0"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            },
            seen=("0", "1"),
            conflict={"flag": True, "exhibits": ["0", "1"]},
        ),
        ctx(ep, frames={"0": ep.PARTY_CLAIMANT, "1": ep.PARTY_SPONSOR}),
    )
    assert record["conflict"] is True
    assert record["conflict_exhibits"] == ["0", "1"]
    assert record["outcome"] == ep.OUT_UNDETERMINED
    assert record["rule"] == "R-OUT-1"


def test_an_observation_on_the_file_asks_for_more_than_the_claimant_frames(ep):
    # R-GRD-4. A programme that named an assessor gets the assessor's reading
    # beside the claimant's own frames before a criterion is met on them.
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {"rating": "SATISFIED", "grounds": ["0"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            },
        ),
        ctx(ep, observation=True),
    )
    assert record["ratings"]["criterion:0"] == ep.RATE_NOT_ESTABLISHED
    # Subject is not a criterion, so it is untouched by R-GRD-4.
    assert record["ratings"]["subject"] == ep.RATE_SATISFIED
    assert record["outcome"] == ep.OUT_UNDETERMINED


def test_the_observation_beside_the_claimant_frames_meets_a_criterion(ep):
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {
                    "rating": "SATISFIED",
                    "grounds": ["0", "observation"],
                },
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            },
        ),
        ctx(ep, observation=True),
    )
    assert record["outcome"] == ep.OUT_ESTABLISHED


def test_an_observation_cited_when_none_was_filed_grounds_nothing(ep):
    record = ep.bind_ratings(
        answer(
            {
                "criterion:0": {"rating": "SATISFIED", "grounds": ["observation"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]},
            },
        ),
        ctx(ep, observation=False),
    )
    assert record["ratings"]["criterion:0"] == ep.RATE_NOT_ESTABLISHED


def test_a_rating_the_model_did_not_give_is_open_not_met(ep):
    record = ep.bind_ratings(answer({}), ctx(ep))
    assert record["ratings"] == {
        "criterion:0": ep.RATE_NOT_ESTABLISHED,
        "subject": ep.RATE_NOT_ESTABLISHED,
    }
    assert record["outcome"] == ep.OUT_UNDETERMINED


def test_not_applicable_on_a_requirement_in_scope_is_not_a_rating(ep):
    # Scope is settled in code. A node cannot write a requirement out of it.
    record = ep.bind_ratings(
        answer({"criterion:0": {"rating": "NOT_APPLICABLE", "grounds": ["0"]},
                "subject": {"rating": "SATISFIED", "grounds": ["0"]}}),
        ctx(ep),
    )
    assert record["ratings"]["criterion:0"] == ep.RATE_NOT_ESTABLISHED


def test_record_order_survives_ten_criteria(ep):
    scope = ["criterion:" + str(n) for n in range(11)] + ["subject"]
    ratings = {key: {"rating": "SATISFIED", "grounds": ["0"]} for key in scope}
    ratings["criterion:2"] = {"rating": "NOT_SATISFIED", "grounds": ["0"]}
    ratings["criterion:10"] = {"rating": "NOT_SATISFIED", "grounds": ["0"]}
    record = ep.bind_ratings(answer(ratings), ctx(ep, scope=scope))
    assert record["failed"] == ["criterion:2", "criterion:10"]
