"""The fixed outcome rule. Same ratings in, same outcome out. R-OUT-1..4."""

import itertools

import pytest


def table(ep):
    return ep.outcome_of


def test_everything_satisfied_establishes(ep):
    ratings = {"criterion:0": ep.RATE_SATISFIED, "subject": ep.RATE_SATISFIED}
    assert ep.outcome_of(ratings, False, True) == (ep.OUT_ESTABLISHED, "R-OUT-4")


def test_one_failed_requirement_with_enough_evidence_does_not_establish(ep):
    ratings = {
        "criterion:0": ep.RATE_SATISFIED,
        "criterion:1": ep.RATE_NOT_SATISFIED,
        "subject": ep.RATE_SATISFIED,
    }
    assert ep.outcome_of(ratings, False, True) == (ep.OUT_NOT_ESTABLISHED, "R-OUT-2")


def test_an_open_requirement_leaves_it_undetermined(ep):
    ratings = {
        "criterion:0": ep.RATE_SATISFIED,
        "subject": ep.RATE_NOT_ESTABLISHED,
    }
    assert ep.outcome_of(ratings, False, True) == (ep.OUT_UNDETERMINED, "R-OUT-3")


def test_a_conflict_leaves_it_undetermined_whatever_the_ratings_say(ep):
    ratings = {"criterion:0": ep.RATE_SATISFIED, "subject": ep.RATE_SATISFIED}
    assert ep.outcome_of(ratings, True, True) == (ep.OUT_UNDETERMINED, "R-OUT-1")


def test_evidence_too_thin_to_decide_leaves_it_undetermined(ep):
    ratings = {"criterion:0": ep.RATE_SATISFIED, "subject": ep.RATE_SATISFIED}
    assert ep.outcome_of(ratings, False, False) == (ep.OUT_UNDETERMINED, "R-OUT-1")


def test_a_failed_requirement_outranks_an_open_one(ep):
    # A file that was read and found wanting is a loss, not a doubt. The order
    # of the clauses is the rule.
    ratings = {
        "criterion:0": ep.RATE_NOT_SATISFIED,
        "criterion:1": ep.RATE_NOT_ESTABLISHED,
    }
    assert ep.outcome_of(ratings, False, True) == (ep.OUT_NOT_ESTABLISHED, "R-OUT-2")


def test_not_applicable_is_ignored(ep):
    ratings = {
        "criterion:0": ep.RATE_SATISFIED,
        "subject": ep.RATE_SATISFIED,
        "cause": ep.RATE_NOT_APPLICABLE,
    }
    assert ep.outcome_of(ratings, False, True) == (ep.OUT_ESTABLISHED, "R-OUT-4")


@pytest.mark.parametrize("conflict", [False, True])
@pytest.mark.parametrize("sufficient", [False, True])
def test_the_whole_table_is_a_function_of_its_inputs(ep, conflict, sufficient):
    pool = [ep.RATE_SATISFIED, ep.RATE_NOT_SATISFIED, ep.RATE_NOT_ESTABLISHED]
    for combination in itertools.product(pool, repeat=3):
        ratings = {"criterion:0": combination[0], "criterion:1": combination[1],
                   "subject": combination[2]}
        once = ep.outcome_of(ratings, conflict, sufficient)
        twice = ep.outcome_of(dict(ratings), conflict, sufficient)
        assert once == twice
        outcome, rule = once
        if conflict or not sufficient:
            assert (outcome, rule) == (ep.OUT_UNDETERMINED, "R-OUT-1")
        elif ep.RATE_NOT_SATISFIED in combination:
            assert (outcome, rule) == (ep.OUT_NOT_ESTABLISHED, "R-OUT-2")
        elif ep.RATE_NOT_ESTABLISHED in combination:
            assert (outcome, rule) == (ep.OUT_UNDETERMINED, "R-OUT-3")
        else:
            assert (outcome, rule) == (ep.OUT_ESTABLISHED, "R-OUT-4")


def test_the_scope_helper_puts_subject_in_every_round(ep):
    assert ep.requirement_scope(2, False, False) == [
        "criterion:0",
        "criterion:1",
        "subject",
    ]
    assert ep.requirement_scope(1, True, True) == [
        "criterion:0",
        "subject",
        "cause",
        "papers",
    ]
