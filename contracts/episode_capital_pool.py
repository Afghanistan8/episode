# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Episode Capital Pool -- additive, native-GEN supplemental settlement.

Episode remains the authority for its own outcome and reserve. This contract
holds a *separate* sponsor-funded benefit and releases it only after the final
Episode receipt and companion-contract gates agree. Credits are pull-based so a
claimant can never be blocked by a recipient that cannot accept a transfer.
"""

from genlayer import *

import typing
from dataclasses import dataclass


OUT_ESTABLISHED = "ESTABLISHED"
TRUTH_CORROBORATED = "CORROBORATED"
INTEGRITY_CLEAR = "CLEAR"
POLICY_PASS = "PASS"


def refuse(code: str, detail: str) -> typing.NoReturn:
    raise gl.vm.UserError("episode-pool/" + code + ": " + detail)


@allow_storage
@dataclass
class Pool:
    sponsor: str
    benefit: u256
    balance: u256
    committed: u256
    paid: u256
    active: bool


@gl.contract_interface
class EpisodeRead:
    class View:
        def programme(self, programme_id: int) -> dict: ...
        def receipt(self, filing_id: int) -> dict: ...
        def filing(self, filing_id: int) -> dict: ...
    class Write:
        pass


@gl.contract_interface
class TruthRead:
    class View:
        def finding(self, filing_id: int) -> dict: ...
    class Write:
        pass


@gl.contract_interface
class IntegrityRead:
    class View:
        def signal(self, filing_id: int) -> dict: ...
    class Write:
        pass


@gl.contract_interface
class GuardRead:
    class View:
        def review_of(self, programme_id: int, version: int) -> dict: ...
    class Write:
        pass


@gl.evm.contract_interface
class Payee:
    class View:
        pass
    class Write:
        pass


class EpisodeCapitalPool(gl.Contract):
    episode: Address
    truth: Address
    integrity: Address
    guard: Address
    pools: TreeMap[str, Pool]
    credit: TreeMap[str, u256]
    settled: TreeMap[str, bool]

    def __init__(self, episode: Address, truth: Address, integrity: Address, guard: Address):
        self.episode = Address(episode)
        self.truth = Address(truth)
        self.integrity = Address(integrity)
        self.guard = Address(guard)

    def _sender(self) -> str:
        return gl.message.sender_address.as_hex

    def _pool(self, programme_id: int) -> Pool:
        held = self.pools.get(str(programme_id))
        if held is None or not held.active:
            refuse("pool-missing", "programme " + str(programme_id) + " has no active supplemental pool")
        return held

    def _sponsor_only(self, programme_id: int) -> Pool:
        held = self._pool(programme_id)
        if held.sponsor.lower() != self._sender().lower():
            refuse("not-sponsor", "only this pool's sponsor may make that change")
        return held

    def _credit(self, who: str, amount: int) -> None:
        if amount <= 0:
            refuse("credit-zero", "zero cannot be credited")
        self.credit[who] = u256(int(self.credit.get(who, u256(0))) + amount)

    @gl.public.write.payable
    def open_pool(self, programme_id: int, benefit: int) -> str:
        if self.pools.get(str(programme_id)) is not None:
            refuse("pool-exists", "programme already has a supplemental pool")
        programme = EpisodeRead(self.episode).view().programme(programme_id)
        if str(programme["sponsor"]).lower() != self._sender().lower():
            refuse("not-sponsor", "only the Episode programme sponsor may open a pool")
        funding = int(gl.message.value)
        if benefit <= 0 or funding < benefit:
            refuse("funding", "attached GEN must cover one positive supplemental benefit")
        self.pools[str(programme_id)] = Pool(
            sponsor=self._sender(), benefit=u256(benefit), balance=u256(funding), committed=u256(0), paid=u256(0), active=True,
        )
        return "pool opened"

    @gl.public.write.payable
    def fund(self, programme_id: int) -> str:
        held = self._sponsor_only(programme_id)
        added = int(gl.message.value)
        if added <= 0:
            refuse("funding", "attach a positive GEN amount")
        held.balance = u256(int(held.balance) + added)
        return "pool funded"

    @gl.public.write
    def set_active(self, programme_id: int, active: bool) -> str:
        held = self._sponsor_only(programme_id)
        held.active = active
        return "pool " + ("active" if active else "paused")

    @gl.public.write
    def settle_supplement(self, filing_id: int) -> str:
        key = str(filing_id)
        if self.settled.get(key, False):
            refuse("settled", "supplement for filing " + key + " is already final")
        episode = EpisodeRead(self.episode)
        receipt = episode.view().receipt(filing_id)
        if not bool(receipt.get("final", False)) or str(receipt.get("outcome", "")) != OUT_ESTABLISHED:
            refuse("episode-finality", "Episode filing must be final and established")
        programme_id = int(receipt["programme"])
        pool = self._pool(programme_id)
        truth = TruthRead(self.truth).view().finding(filing_id)
        if str(truth.get("status", "")) != TRUTH_CORROBORATED:
            refuse("truth", "the source corroboration result is not CORROBORATED")
        signal = IntegrityRead(self.integrity).view().signal(filing_id)
        if str(signal.get("status", "")) != INTEGRITY_CLEAR:
            refuse("integrity", "the integrity graph has not cleared this filing")
        guard = GuardRead(self.guard).view().review_of(programme_id, int(receipt["version"]))
        if str(guard.get("status", "")) != POLICY_PASS:
            refuse("policy", "the bound policy version has not passed its consensus review")
        benefit = int(pool.benefit)
        idle = int(pool.balance) - int(pool.committed)
        if idle < benefit:
            refuse("reserve", "pool idle balance cannot cover the supplemental benefit")
        filing = episode.view().filing(filing_id)
        claimant = str(filing["claimant"])
        pool.committed = u256(int(pool.committed) + benefit)
        # One atomic settlement: claimant credit, pool accounting and idempotency
        # marker are written in the same accepted contract execution.
        pool.committed = u256(int(pool.committed) - benefit)
        pool.balance = u256(int(pool.balance) - benefit)
        pool.paid = u256(int(pool.paid) + benefit)
        self._credit(claimant, benefit)
        self.settled[key] = True
        return "supplement credited"

    @gl.public.write
    def draw_idle(self, programme_id: int, amount: int) -> str:
        held = self._sponsor_only(programme_id)
        if amount <= 0 or amount > int(held.balance) - int(held.committed):
            refuse("idle", "amount must be positive and no more than idle balance")
        held.balance = u256(int(held.balance) - amount)
        self._credit(held.sponsor, amount)
        return "idle credit created"

    @gl.public.write
    def withdraw(self) -> str:
        who = self._sender()
        owed = int(self.credit.get(who, u256(0)))
        if owed <= 0:
            refuse("credit-empty", "no pool credit is owed to this address")
        self.credit[who] = u256(0)
        Payee(Address(who)).emit_transfer(value=u256(owed))
        return str(owed)

    @gl.public.view
    def pool(self, programme_id: int) -> dict:
        held = self.pools.get(str(programme_id))
        if held is None:
            return {"active": False, "sponsor": "", "benefit": "0", "balance": "0", "committed": "0", "idle": "0", "paid": "0"}
        return {"active": bool(held.active), "sponsor": held.sponsor, "benefit": str(int(held.benefit)), "balance": str(int(held.balance)), "committed": str(int(held.committed)), "idle": str(int(held.balance) - int(held.committed)), "paid": str(int(held.paid))}

    @gl.public.view
    def credit_of(self, who: str) -> str:
        return str(int(self.credit.get(who, u256(0))))

    @gl.public.view
    def is_settled(self, filing_id: int) -> bool:
        return bool(self.settled.get(str(filing_id), False))
