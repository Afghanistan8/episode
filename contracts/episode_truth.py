# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Episode Truth -- an additive, source-bound corroboration layer.

This contract deliberately does not alter Episode.  It reads Episode's public
receipt, evaluates only sources the programme sponsor has allow-listed, and
keeps a compact consensus receipt of the result.  A capital pool may choose to
require this result before releasing its *own* supplemental benefit.
"""

from genlayer import *

import hashlib
import json
import typing
from dataclasses import dataclass


MAX_SOURCES = 4
MAX_URL = 480
MAX_FIELD = 80
MAX_VALUE = 240
MAX_BODY = 8192

STATUS_NONE = "NONE"
STATUS_CORROBORATED = "CORROBORATED"
STATUS_CONTRADICTED = "CONTRADICTED"
STATUS_INCONCLUSIVE = "INCONCLUSIVE"
STATUSES = (STATUS_NONE, STATUS_CORROBORATED, STATUS_CONTRADICTED, STATUS_INCONCLUSIVE)


def refuse(code: str, detail: str) -> typing.NoReturn:
    raise gl.vm.UserError("episode-truth/" + code + ": " + detail)


def clean_url(value: str) -> str:
    value = value.strip()
    if not value.startswith("https://") or len(value) > MAX_URL:
        refuse("source-url", "source URLs must be https and at most " + str(MAX_URL) + " characters")
    return value


def clean_field(value: str, name: str) -> str:
    value = value.strip()
    if not value or len(value) > MAX_FIELD:
        refuse("source-field", name + " must be 1.." + str(MAX_FIELD) + " characters")
    return value


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


@allow_storage
@dataclass
class Source:
    url: str
    field: str
    expected: str
    label: str


@allow_storage
@dataclass
class Policy:
    sponsor: str
    source_json: str
    minimum_matches: u8
    active: bool


@allow_storage
@dataclass
class Finding:
    status: str
    matches: u8
    checked: u8
    source_digest: str
    receipt_digest: str
    resolved_at: u64


@gl.contract_interface
class EpisodeRead:
    class View:
        def programme(self, programme_id: int) -> dict: ...
        def receipt(self, filing_id: int) -> dict: ...
    class Write:
        pass


class EpisodeTruth(gl.Contract):
    """Consensus-friendly public-source corroboration for Episode receipts."""

    episode: Address
    policies: TreeMap[str, Policy]
    findings: TreeMap[str, Finding]

    def __init__(self, episode: Address):
        # Deployment calldata represents addresses as hex strings. Convert at
        # the storage boundary: Address storage expects the SDK value, not the
        # JSON-RPC string passed to the constructor.
        self.episode = Address(episode)

    def _episode(self):
        return EpisodeRead(self.episode)

    def _sender(self) -> str:
        return gl.message.sender_address.as_hex

    def _now(self) -> int:
        # GenVM provides this field as a UTC ISO prefix.  Storing block time is
        # useful for receipts but never participates in validator comparison.
        stamp = str(gl.message_raw["datetime"])
        import calendar
        import datetime
        return calendar.timegm(datetime.datetime.strptime(stamp[:19], "%Y-%m-%dT%H:%M:%S").timetuple())

    def _policy(self, programme_id: int) -> Policy:
        held = self.policies.get(str(programme_id))
        if held is None or not held.active:
            refuse("policy-missing", "programme " + str(programme_id) + " has no active source policy")
        return held

    @gl.public.write
    def configure_policy(self, programme_id: int, sources: list[dict], minimum_matches: int) -> str:
        programme = self._episode().view().programme(programme_id)
        if str(programme["sponsor"]).lower() != self._sender().lower():
            refuse("not-sponsor", "only the Episode programme sponsor may configure sources")
        if not 1 <= len(sources) <= MAX_SOURCES:
            refuse("source-count", "configure 1.." + str(MAX_SOURCES) + " sources")
        if minimum_matches < 1 or minimum_matches > len(sources):
            refuse("minimum", "minimum matches must be between one and source count")
        safe = []
        for source in sources:
            if not isinstance(source, dict):
                refuse("source-shape", "every source must be an object")
            expected = str(source.get("expected", "")).strip()
            label = str(source.get("label", "")).strip()
            if not expected or len(expected) > MAX_VALUE:
                refuse("source-expected", "expected value must be 1.." + str(MAX_VALUE) + " characters")
            if not label or len(label) > MAX_FIELD:
                refuse("source-label", "label must be 1.." + str(MAX_FIELD) + " characters")
            safe.append({
                "url": clean_url(str(source.get("url", ""))),
                "field": clean_field(str(source.get("field", "")), "field"),
                "expected": expected,
                "label": label,
            })
        self.policies[str(programme_id)] = Policy(
            sponsor=self._sender(),
            source_json=json.dumps(safe, sort_keys=True, separators=(",", ":")),
            minimum_matches=u8(minimum_matches),
            active=True,
        )
        return "policy configured"

    @gl.public.write
    def deactivate_policy(self, programme_id: int) -> str:
        held = self._policy(programme_id)
        if held.sponsor.lower() != self._sender().lower():
            refuse("not-sponsor", "only the source-policy sponsor may deactivate it")
        held.active = False
        return "policy deactivated"

    def _fetch_summary(self, sources: list[dict]) -> dict:
        """Fetch an allow-listed JSON field and return no volatile data.

        Validators independently run this in the nondeterministic block.  The
        final comparison is only the compact status/match count and a digest of
        the canonical field values, never a timestamp or complete web page.
        """
        rows = []
        for source in sources:
            response = gl.nondet.web.get(source["url"])
            wire = response.body
            body = wire if isinstance(wire, bytes) else str(wire).encode("utf-8")
            body = body[:MAX_BODY]
            try:
                parsed = json.loads(body.decode("utf-8"))
            except Exception:
                rows.append({"label": source["label"], "state": "UNREADABLE", "value": ""})
                continue
            value = parsed.get(source["field"])
            if isinstance(value, (dict, list)) or value is None:
                rows.append({"label": source["label"], "state": "MISSING", "value": ""})
                continue
            text = str(value).strip()[:MAX_VALUE]
            rows.append({
                "label": source["label"],
                "state": "MATCH" if text == source["expected"] else "MISMATCH",
                "value": text,
            })
        matches = sum(1 for row in rows if row["state"] == "MATCH")
        mismatches = sum(1 for row in rows if row["state"] == "MISMATCH")
        minimum = int(sources[0]["minimum_matches"])
        status = STATUS_CORROBORATED if matches >= minimum else (
            STATUS_CONTRADICTED if mismatches >= minimum else STATUS_INCONCLUSIVE
        )
        # The digest deliberately excludes the fetched value. A value may
        # differ across validator requests even where every validator reaches
        # the same stable match state; the receipt proves exactly that agreed
        # state, rather than pretending to freeze a remote page.
        agreed = [{"label": row["label"], "state": row["state"]} for row in rows]
        canonical = json.dumps(agreed, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return {"status": status, "matches": matches, "checked": len(rows), "digest": digest(canonical)}

    @gl.public.write
    def resolve(self, filing_id: int) -> str:
        receipt = self._episode().view().receipt(filing_id)
        programme_id = int(receipt["programme"])
        policy = self._policy(programme_id)
        sources = json.loads(policy.source_json)
        for source in sources:
            source["minimum_matches"] = int(policy.minimum_matches)

        def leader():
            return self._fetch_summary(sources)

        def validator(proposed):
            if not isinstance(proposed, gl.vm.Return) or not isinstance(proposed.calldata, dict):
                return False
            mine = self._fetch_summary(sources)
            their = proposed.calldata
            return (
                their.get("status") in STATUSES
                and their.get("status") == mine["status"]
                and their.get("matches") == mine["matches"]
                and their.get("checked") == mine["checked"]
                and their.get("digest") == mine["digest"]
            )

        answer = gl.vm.run_nondet_unsafe(leader, validator)
        receipt_digest = digest(json.dumps(receipt, sort_keys=True, separators=(",", ":")).encode("utf-8"))
        self.findings[str(filing_id)] = Finding(
            status=str(answer["status"]), matches=u8(answer["matches"]), checked=u8(answer["checked"]),
            source_digest=str(answer["digest"]), receipt_digest=receipt_digest, resolved_at=u64(self._now()),
        )
        return str(answer["status"])

    @gl.public.view
    def finding(self, filing_id: int) -> dict:
        held = self.findings.get(str(filing_id))
        if held is None:
            return {"status": STATUS_NONE, "matches": "0", "checked": "0", "source_digest": "", "receipt_digest": "", "resolved_at": "0"}
        return {"status": held.status, "matches": str(int(held.matches)), "checked": str(int(held.checked)), "source_digest": held.source_digest, "receipt_digest": held.receipt_digest, "resolved_at": str(int(held.resolved_at))}

    @gl.public.view
    def policy(self, programme_id: int) -> dict:
        held = self.policies.get(str(programme_id))
        if held is None:
            return {"active": False, "sponsor": "", "sources": [], "minimum_matches": "0"}
        return {"active": bool(held.active), "sponsor": held.sponsor, "sources": json.loads(held.source_json), "minimum_matches": str(int(held.minimum_matches))}
