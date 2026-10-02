"""The worked example in docs/money.md, run against the contract.

A doc that says where the money goes is only worth reading if it is still
true, so the table in docs/money.md is a test rather than prose.
"""

import genlayer
from helpers import BYSTANDER, CLAIMANT, DAY, SPONSOR, Script, met

GEN = 10**18
SCOPE = ("criterion:0", "criterion:1", "subject", "cause")

# balance, committed, idle, claimant credit, sponsor credit -- all in whole GEN,
# exactly as the table in docs/money.md prints them.
TABLE = [
    ("opened and funded", (500, 0, 500, 0, 0)),
    ("filing A lodged", (500, 100, 400, 0, 0)),
    ("filing B lodged", (500, 200, 300, 0, 0)),
    ("filing C lodged", (500, 300, 200, 0, 0)),
    ("A sealed ESTABLISHED", (400, 200, 200, 105, 0)),
    ("B sealed NOT_ESTABLISHED", (405, 100, 305, 105, 0)),
    ("C lapsed and closed", (410, 0, 410, 105, 0)),
    ("sponsor draws 400", (10, 0, 10, 105, 400)),
    ("both withdraw", (10, 0, 10, 0, 0)),
]


def test_the_worked_example_in_the_money_doc_still_holds(court, ep):
    court.open_programme(award=100 * GEN, stake=5 * GEN, reserve=500 * GEN)
    seen = []

    def row(label):
        held = court.read("programme", 0)
        seen.append(
            (
                label,
                (
                    int(held["balance"]) // GEN,
                    int(held["committed"]) // GEN,
                    int(held["idle"]) // GEN,
                    int(court.read("credit_of", CLAIMANT)) // GEN,
                    int(court.read("credit_of", SPONSOR)) // GEN,
                ),
            )
        )

    row("opened and funded")
    for name in "ABC":
        court.lodge(value=5 * GEN)
        row(f"filing {name} lodged")

    for filing_id, outcome in ((0, "ESTABLISHED"), (1, "NOT_ESTABLISHED")):
        court.stock_file(filing_id)
        ratings = met(*SCOPE, grounds=("0", "1"))
        if outcome == "NOT_ESTABLISHED":
            ratings["criterion:0"] = {"rating": "NOT_SATISFIED", "grounds": ["0"]}
        Script(ratings=ratings).install()
        assert court.send("convene", filing_id, sender=CLAIMANT) == outcome
        court.tick(3 * DAY + 1)
        court.send("seal", filing_id, sender=BYSTANDER)
        row(f"{'AB'[filing_id]} sealed {outcome}")

    court.tick(8 * DAY)
    court.send("close_lapsed", 2, sender=BYSTANDER)
    row("C lapsed and closed")

    court.send("draw_idle_reserve", 0, 400 * GEN, sender=SPONSOR)
    row("sponsor draws 400")

    court.send("withdraw", sender=CLAIMANT)
    court.send("withdraw", sender=SPONSOR)
    row("both withdraw")

    assert seen == TABLE

    # 500 funded plus three bonds of 5 comes back out as the reserve left
    # standing plus everything collected. Nothing was created or lost.
    held = court.read("programme", 0)
    collected = sum(amount for _, amount in genlayer.transfers)
    assert int(held["balance"]) + collected == 500 * GEN + 3 * 5 * GEN
    assert collected == 505 * GEN
