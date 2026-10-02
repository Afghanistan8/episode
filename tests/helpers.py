"""Fixtures and a small driver for calling the contract like a wallet would."""

import json

import genlayer

# Accounts. Twenty bytes each, legible on sight in a failure message.
SPONSOR = "0x" + "a1" * 20
CLAIMANT = "0x" + "b2" * 20
OTHER_CLAIMANT = "0x" + "b3" * 20
ASSESSOR = "0x" + "c4" * 20
BYSTANDER = "0x" + "d5" * 20

START = 1_777_000_000  # a fixed epoch, so every deadline in a test is readable

GEN = 10**18
AWARD = 40 * GEN
STAKE = 2 * GEN
RESERVE = 200 * GEN

DAY = 24 * 60 * 60


def png(tag: bytes = b"frame") -> bytes:
    """A PNG by its full eight-byte signature. A scene photograph."""
    return b"\x89PNG\r\n\x1a\n" + b"IHDR" + tag + b"\x00" * 24


def jpeg(tag: bytes = b"frame") -> bytes:
    """A JFIF JPEG: ff d8 ff, then the JFIF marker at offset six."""
    return b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00" + tag + b"\x00" * 24


def exif_jpeg(tag: bytes = b"frame") -> bytes:
    """A JPEG whose header says Exif, not JFIF. Paperwork, by the rule."""
    return b"\xff\xd8\xff\xe1\x00\x10Exif\x00\x00" + tag + b"\x00" * 24


def pdf(tag: bytes = b"paper") -> bytes:
    return b"%PDF-1.7\n%%EOF\n" + tag


def sheet(text: str = "container MSKU 418 322 7, 1 x 40ft, seals intact") -> bytes:
    return text.encode("utf-8")


class Court:
    """Drives the contract: sets the message and the clock, then calls."""

    def __init__(self, module):
        self.module = module
        self.contract = module.Episode()
        self.now = START
        genlayer.gl.set_clock(self.now)

    # -- time ---------------------------------------------------------------

    def tick(self, seconds: int) -> int:
        self.now += int(seconds)
        genlayer.gl.set_clock(self.now)
        return self.now

    def at(self, epoch: int) -> int:
        self.now = int(epoch)
        genlayer.gl.set_clock(self.now)
        return self.now

    # -- calls --------------------------------------------------------------

    def send(self, method: str, *args, sender: str = SPONSOR, value: int = 0, **kwargs):
        genlayer.gl.set_message(sender, value)
        genlayer.gl.set_clock(self.now)
        return getattr(self.contract, method)(*args, **kwargs)

    def read(self, method: str, *args, **kwargs):
        genlayer.gl.set_clock(self.now)
        return getattr(self.contract, method)(*args, **kwargs)

    def exhibits(self, filing_id=0):
        """The exhibit rows of one filing, which is what tests want of it."""
        return self.read("exhibit_index", filing_id)["rows"]

    # -- set-up shorthands --------------------------------------------------

    def open_programme(self, **over):
        terms = dict(
            category=self.module.CAT_PROPERTY,
            kind="gala-venue-water",
            definition=(
                "Water reached the floor of the named venue on the event date "
                "and left the floor unusable."
            ),
            exclusions="Condensation, cleaning water, and damage predating the booking.",
            criteria=[
                "Standing water or a water line is visible on the venue floor.",
                "The floor shown cannot be walked or staged on.",
            ],
            min_frames=2,
            required_views=["wide", "detail"],
            paper_required=False,
            paper_kind="",
            award=AWARD,
            stake=STAKE,
            evidence_window=7 * DAY,
            appeal_window=3 * DAY,
            assessor="",
        )
        terms.update(over)
        reserve = terms.pop("reserve", RESERVE)
        return self.send(
            "open_programme", sender=SPONSOR, value=reserve, **terms
        )

    def lodge(self, programme_id=0, version=1, sender=CLAIMANT, value=STAKE, **over):
        claim = dict(
            subject_label="Thornbury Assembly Rooms, main floor",
            subject_identifier="POL-44198",
            event_date="2026-05-02",
            declared_cause="storm water through the roof light",
        )
        claim.update(over)
        return self.send(
            "lodge", programme_id, version, sender=sender, value=value, **claim
        )

    def attach(
        self,
        filing_id,
        blob,
        view_label="wide",
        paper_kind="",
        caption="",
        sender=CLAIMANT,
    ):
        return self.send(
            "attach_exhibit",
            filing_id,
            blob,
            view_label,
            paper_kind,
            caption,
            sender=sender,
        )

    def stock_file(self, filing_id=0, sender=CLAIMANT):
        """The two frames and the labels a default programme asks for."""
        wide = self.attach(filing_id, png(b"wide"), "wide", sender=sender)
        detail = self.attach(filing_id, jpeg(b"detail"), "detail", sender=sender)
        return wide, detail


class Script:
    """A scripted panel: answers the sighting, paperwork and rating passes.

    It reads the prompt only to tell the passes apart, which is the same
    thing a real node does when it decides which call it is answering.
    """

    def __init__(self, ratings=None, sufficient=True, conflict=None, illegible=()):
        self.ratings = ratings or {}
        self.sufficient = sufficient
        self.conflict = conflict or {"flag": False, "exhibits": []}
        self.illegible = set(illegible)
        self.seen_prompts = []

    def install(self):
        genlayer.gl.nondet.answer = self
        return self

    def __call__(self, prompt, images):
        self.seen_prompts.append(prompt)
        if "photograph(s) filed as evidence" in prompt:
            return json.dumps({"frames": [self._frame(i) for i in self._ids(prompt)]})
        if "photographed document(s)" in prompt:
            return json.dumps(
                {
                    "papers": [
                        {"exhibit": i, "reading": "signed, dated, stamped", "kind": "note"}
                        for i in self._ids(prompt)
                    ]
                }
            )
        return json.dumps(
            {
                "ratings": self.ratings,
                "sufficient": self.sufficient,
                "conflict": self.conflict,
            }
        )

    @staticmethod
    def _ids(prompt):
        found = []
        for line in prompt.split("."):
            if " is exhibit " in line:
                found.append(line.split(" is exhibit ")[1].strip())
        return found

    def _frame(self, exhibit):
        return {
            "exhibit": exhibit,
            "legible": exhibit not in self.illegible,
            "scope": "wide",
            "shows": "a flooded hall floor with staging stacked at the back",
            "marks": "door plate reads 4",
            "damage": "standing water two centimetres deep, tide line on skirting",
            "activity": "no work under way",
        }


def met(*keys, grounds=("0",)):
    """Every named requirement satisfied on the given grounds."""
    return {key: {"rating": "SATISFIED", "grounds": list(grounds)} for key in keys}
