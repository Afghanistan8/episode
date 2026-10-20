# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Episode Integrity Graph -- opt-in cross-filing evidence-reuse signals.

The graph never denies a claim. It records exact evidence reuse as
REVIEW_REQUIRED so a companion pool can withhold only its additional benefit
pending a human/appeal workflow.
"""

from genlayer import *

import json
import typing
from dataclasses import dataclass


STATUS_NONE = "NONE"
STATUS_CLEAR = "CLEAR"
STATUS_REVIEW = "REVIEW_REQUIRED"
REASONS = ("", "EXACT_EVIDENCE_REUSE")


def refuse(code: str, detail: str) -> typing.NoReturn:
    raise gl.vm.UserError("episode-integrity/" + code + ": " + detail)


@allow_storage
@dataclass
class Signal:
    status: str
    reason: str
    related_filing: str
    similarity_bps: u16
    receipt_digest: str
    indexed_at: u64


@gl.contract_interface
class EpisodeRead:
    class View:
        def receipt(self, filing_id: int) -> dict: ...
        def filing(self, filing_id: int) -> dict: ...
    class Write:
        pass


class EpisodeIntegrityGraph(gl.Contract):
    episode: Address
    similarity_threshold_bps: u16
    signals: TreeMap[str, Signal]
    first_seen_hash: TreeMap[str, str]
    indexed: TreeMap[str, bool]

    def __init__(self, episode: Address, similarity_threshold_bps: int):
        if similarity_threshold_bps < 1 or similarity_threshold_bps > 10000:
            refuse("threshold", "similarity threshold must be 1..10000 basis points")
        self.episode = Address(episode)
        self.similarity_threshold_bps = u16(similarity_threshold_bps)

    def _now(self) -> int:
        import calendar
        import datetime
        stamp = str(gl.message_raw["datetime"])
        return calendar.timegm(datetime.datetime.strptime(stamp[:19], "%Y-%m-%dT%H:%M:%S").timetuple())

    def _receipt_digest(self, receipt: dict) -> str:
        import hashlib
        return hashlib.sha256(json.dumps(receipt, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()

    @gl.public.write
    def index_filing(self, filing_id: int) -> str:
        key = str(filing_id)
        if self.indexed.get(key, False):
            refuse("indexed", "filing " + key + " has already been indexed")
        episode = EpisodeRead(self.episode)
        receipt = episode.view().receipt(filing_id)
        exact = ""
        exhibits = receipt.get("exhibits", [])
        if isinstance(exhibits, list):
            for exhibit in exhibits:
                if not isinstance(exhibit, dict):
                    continue
                evidence_hash = str(exhibit.get("sha256", ""))
                if not evidence_hash:
                    continue
                earlier = self.first_seen_hash.get(evidence_hash, "")
                if earlier and earlier != key:
                    exact = earlier
                    break

        similarity_bps = 0

        if exact:
            status, reason, related = STATUS_REVIEW, "EXACT_EVIDENCE_REUSE", exact
            similarity_bps = 10000
        else:
            status, reason, related = STATUS_CLEAR, "", ""

        if isinstance(exhibits, list):
            for exhibit in exhibits:
                if isinstance(exhibit, dict):
                    evidence_hash = str(exhibit.get("sha256", ""))
                    if evidence_hash and not self.first_seen_hash.get(evidence_hash, ""):
                        self.first_seen_hash[evidence_hash] = key
        self.signals[key] = Signal(
            status=status, reason=reason, related_filing=related, similarity_bps=u16(similarity_bps),
            receipt_digest=self._receipt_digest(receipt), indexed_at=u64(self._now()),
        )
        self.indexed[key] = True
        return status

    @gl.public.view
    def signal(self, filing_id: int) -> dict:
        held = self.signals.get(str(filing_id))
        if held is None:
            return {"status": STATUS_NONE, "reason": "", "related_filing": "", "similarity_bps": "0", "receipt_digest": "", "indexed_at": "0"}
        return {"status": held.status, "reason": held.reason, "related_filing": held.related_filing, "similarity_bps": str(int(held.similarity_bps)), "receipt_digest": held.receipt_digest, "indexed_at": str(int(held.indexed_at))}

    @gl.public.view
    def threshold(self) -> str:
        return str(int(self.similarity_threshold_bps))
