"""What a validator will and will not sign. R-EQV-1..3."""

import copy


def record(ep, seen=("0",), outcome=None, failed=None, bound=None, **over):
    base = {
        "seen": list(seen),
        "scope": ["criterion:0", "subject"],
        "ratings": {
            "criterion:0": ep.RATE_SATISFIED,
            "subject": ep.RATE_SATISFIED,
        },
        "grounds": {"criterion:0": ["0"], "subject": ["0"]},
        "conflict": False,
        "conflict_exhibits": [],
        "sufficient": True,
        "blind": False,
        "bound": bound if bound is not None else ["criterion:0", "subject"],
        "failed": failed if failed is not None else [],
        "outcome": outcome or ep.OUT_ESTABLISHED,
        "rule": "R-OUT-4",
    }
    base.update(over)
    return base


def test_an_identical_record_is_signed(ep):
    mine = record(ep)
    assert ep.rounds_agree(mine, copy.deepcopy(mine))


def test_a_leader_that_omitted_a_frame_this_node_saw_is_rejected(ep):
    # R-PNL-4. Dropping a photograph to get the answer you want does not work.
    mine = record(ep, seen=("0", "1"))
    theirs = record(ep, seen=("0",))
    assert not ep.rounds_agree(mine, theirs)


def test_a_leader_that_saw_more_than_this_node_is_still_signable(ep):
    # A node judges from what it saw. Seeing less is not a reason to reject,
    # as long as the finding is still this node's own finding.
    mine = record(ep, seen=("0",))
    theirs = record(ep, seen=("0", "1"))
    assert ep.rounds_agree(mine, theirs)


def test_a_different_outcome_is_rejected(ep):
    mine = record(ep)
    theirs = record(ep, outcome=ep.OUT_UNDETERMINED, rule="R-OUT-3")
    assert not ep.rounds_agree(mine, theirs)


def test_doubt_here_does_not_sign_an_established_record(ep):
    mine = record(
        ep,
        ratings={"criterion:0": ep.RATE_NOT_ESTABLISHED, "subject": ep.RATE_SATISFIED},
        bound=["subject"],
        outcome=ep.OUT_UNDETERMINED,
        rule="R-OUT-3",
    )
    assert not ep.rounds_agree(mine, record(ep))


def test_the_same_outcome_under_a_different_rule_is_rejected(ep):
    mine = record(ep, outcome=ep.OUT_UNDETERMINED, rule="R-OUT-3",
                  ratings={"criterion:0": ep.RATE_NOT_ESTABLISHED,
                           "subject": ep.RATE_SATISFIED},
                  bound=["subject"])
    theirs = record(ep, outcome=ep.OUT_UNDETERMINED, rule="R-OUT-1",
                    conflict=True, conflict_exhibits=["0", "1"],
                    ratings={"criterion:0": ep.RATE_NOT_ESTABLISHED,
                             "subject": ep.RATE_SATISFIED},
                    bound=["subject"])
    assert not ep.rounds_agree(mine, theirs)


def test_a_rejection_must_fail_the_same_requirements(ep):
    # R-EQV-2. Agreeing that it failed is not enough; it has to fail on the
    # same requirements.
    mine = record(
        ep,
        ratings={"criterion:0": ep.RATE_NOT_SATISFIED, "subject": ep.RATE_SATISFIED},
        failed=["criterion:0"],
        outcome=ep.OUT_NOT_ESTABLISHED,
        rule="R-OUT-2",
    )
    theirs = record(
        ep,
        ratings={"criterion:0": ep.RATE_SATISFIED, "subject": ep.RATE_NOT_SATISFIED},
        failed=["subject"],
        outcome=ep.OUT_NOT_ESTABLISHED,
        rule="R-OUT-2",
    )
    assert not ep.rounds_agree(mine, theirs)


def test_a_record_that_does_not_follow_from_its_own_ratings_is_rejected(ep):
    # A leader cannot read as established on the file while shipping ratings
    # that say otherwise.
    mine = record(ep)
    theirs = record(ep)
    theirs["ratings"] = {
        "criterion:0": ep.RATE_NOT_SATISFIED,
        "subject": ep.RATE_SATISFIED,
    }
    assert not ep.rounds_agree(mine, theirs)


def test_a_blind_round_does_not_sign_a_sighted_one(ep):
    mine = record(ep, seen=(), blind=True, outcome=ep.OUT_UNDETERMINED,
                  rule="R-OUT-1", bound=[], ratings={}, sufficient=False)
    theirs = record(ep, seen=(), blind=False, outcome=ep.OUT_UNDETERMINED,
                    rule="R-OUT-1", bound=[], ratings={}, sufficient=False)
    assert not ep.rounds_agree(mine, theirs)


def test_a_record_missing_a_field_is_rejected(ep):
    mine = record(ep)
    theirs = record(ep)
    del theirs["grounds"]
    assert not ep.rounds_agree(mine, theirs)


def test_nodes_that_pulled_different_document_bytes_do_not_agree(ep):
    # R-EXH-6. Two nodes that read different files have not read the same file.
    mine = record(ep, fetched={"2": {"digest": "aa", "size": 10, "wire": "x"}})
    theirs = record(ep, fetched={"2": {"digest": "bb", "size": 10, "wire": "y"}})
    assert not ep.rounds_agree(mine, theirs)
    same = record(ep, fetched={"2": {"digest": "aa", "size": 10, "wire": "x"}})
    assert ep.rounds_agree(mine, same)


def test_free_text_is_never_compared(ep):
    # The record carries ids, ratings and a rule. Nothing a model wrote in
    # prose reaches storage, so nothing in prose can split a round.
    mine = record(ep)
    theirs = record(ep)
    theirs["note"] = "the hall was plainly under water, and I say so at length"
    assert ep.rounds_agree(mine, theirs)
