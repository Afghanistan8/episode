"""A stand-in for the GenVM runtime, enough of it to drive Episode in pytest.

This is a test double, not a simulator. It exists because the deterministic
rules in `contracts/episode.py` are the part that has to be provable without
a validator, and the only honest way to prove them is to run the contract
itself rather than a copy of its arithmetic.

What it is faithful about, because the tests lean on it:

  * fixed-width integers refuse to hold a negative or an overflow, so an
    accounting slip raises here instead of wrapping quietly
  * storage fields are zero-initialised from their annotations, as GenVM
    does, so `__init__` can leave them alone
  * `exec_prompt` refuses more than two images, which is the real ceiling
  * `run_nondet_unsafe` actually runs the validator against the leader and
    fails the round when it disagrees
  * a payout leaves through the declared wallet interface and is recorded,
    so a test can check who was paid what

What it does not do: consensus over several validators, gas, rotation, or
anything about the chain beyond one transaction's message.
"""

import copy
import datetime

__all__ = [
    "gl",
    "Address",
    "allow_storage",
    "DynArray",
    "TreeMap",
    "bigint",
    "u8",
    "u16",
    "u32",
    "u64",
    "u128",
    "u256",
    "i8",
    "i16",
    "i32",
    "i64",
    "i128",
    "i256",
]


# -- fixed-width integers ---------------------------------------------------


class _Int:
    def __init__(self, name: str, bits: int, signed: bool):
        self.name = name
        self.bits = bits
        self.signed = signed
        self.low = -(1 << (bits - 1)) if signed else 0
        self.high = (1 << (bits - 1)) - 1 if signed else (1 << bits) - 1

    def __call__(self, value=0):
        held = int(value)
        if held < self.low or held > self.high:
            raise OverflowError(
                self.name + " holds " + str(self.low) + ".." + str(self.high)
                + ", got " + str(held)
            )
        return held

    def __repr__(self):
        return self.name


u8 = _Int("u8", 8, False)
u16 = _Int("u16", 16, False)
u32 = _Int("u32", 32, False)
u64 = _Int("u64", 64, False)
u128 = _Int("u128", 128, False)
u256 = _Int("u256", 256, False)
i8 = _Int("i8", 8, True)
i16 = _Int("i16", 16, True)
i32 = _Int("i32", 32, True)
i64 = _Int("i64", 64, True)
i128 = _Int("i128", 128, True)
i256 = _Int("i256", 256, True)
bigint = int


# -- storage containers -----------------------------------------------------


class _Spec:
    def __init__(self, kind, args):
        self.kind = kind
        self.args = args

    def __repr__(self):
        return self.kind + "[" + repr(self.args) + "]"


class DynArray(list):
    def __class_getitem__(cls, item):
        return _Spec("DynArray", item)


class TreeMap(dict):
    def __class_getitem__(cls, item):
        return _Spec("TreeMap", item)


def allow_storage(cls):
    return cls


class Address:
    __slots__ = ("_hex",)

    def __init__(self, value):
        if isinstance(value, Address):
            value = value.as_hex
        if isinstance(value, (bytes, bytearray)):
            value = "0x" + bytes(value).hex()
        text = str(value)
        if not text.startswith("0x") or len(text) != 42:
            raise ValueError("not an address: " + repr(value))
        int(text, 16)
        self._hex = text

    @property
    def as_hex(self) -> str:
        return self._hex

    def __eq__(self, other):
        return isinstance(other, Address) and other._hex.lower() == self._hex.lower()

    def __hash__(self):
        return hash(self._hex.lower())

    def __repr__(self):
        return "Address(" + self._hex + ")"


# -- the gl namespace -------------------------------------------------------


class UserError(Exception):
    """What a contract raises to refuse a call."""


class Return:
    """A leader result that came back rather than raised."""

    def __init__(self, calldata):
        self.calldata = calldata


class Rollback(Exception):
    """A round the validator would not sign."""


def _mark(kind):
    def decorate(fn):
        fn.genlayer_kind = kind
        return fn

    return decorate


class _WriteMarkers:
    def __call__(self, fn):
        return _mark("write")(fn)

    payable = staticmethod(_mark("write.payable"))


class _PublicMarkers:
    view = staticmethod(_mark("view"))
    write = _WriteMarkers()


class _Message:
    def __init__(self):
        self.sender_address = Address("0x" + "00" * 20)
        self.origin_address = self.sender_address
        self.contract_address = Address("0x" + "ee" * 20)
        self.value = 0
        self.chain_id = 61997


class _WebAnswer:
    def __init__(self, body):
        self.body = body
        self.status = 200


class _Web:
    """Pages the panel is allowed to pull, installed by a test."""

    def __init__(self):
        self.pages = {}
        self.fetched = []

    def get(self, url, **kwargs):
        self.fetched.append(url)
        if url not in self.pages:
            raise UserError("the double has no page at " + url)
        return _WebAnswer(self.pages[url])

    def render(self, url, mode="text", **kwargs):
        return self.get(url).body


class _Nondet:
    """exec_prompt, answered by a script a test installs."""

    def __init__(self):
        self.web = _Web()
        self.answer = None
        self.calls = []

    def exec_prompt(self, prompt, images=None, **kwargs):
        frames = list(images or [])
        if len(frames) > 2:
            raise UserError(
                "exec_prompt takes at most two images, got " + str(len(frames))
            )
        self.calls.append({"prompt": prompt, "images": frames})
        if self.answer is None:
            raise UserError("no prompt script is installed on the double")
        return self.answer(prompt, frames)


class _Storage:
    @staticmethod
    def copy_to_memory(value):
        return copy.deepcopy(value)

    @staticmethod
    def inmem_allocate(kind, *args, **kwargs):
        if isinstance(kind, _Spec):
            return DynArray() if kind.kind == "DynArray" else TreeMap()
        return kind(*args, **kwargs)


_ZEROES = {
    str: "",
    bytes: b"",
    bool: False,
    float: 0.0,
    int: 0,
}


def _zero_for(annotation):
    if isinstance(annotation, _Spec):
        return DynArray() if annotation.kind == "DynArray" else TreeMap()
    if isinstance(annotation, _Int):
        return 0
    if annotation in _ZEROES:
        return _ZEROES[annotation]
    if annotation is Address:
        return Address("0x" + "00" * 20)
    raise TypeError("no zero value for a storage field of " + repr(annotation))


class Contract:
    """Base for an intelligent contract. Zero-initialises declared storage."""

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        written = cls.__dict__.get("__init__")
        if written is None or getattr(written, "genlayer_wrapped", False):
            return

        def start(self, *args, **kwargs):
            for base in reversed(cls.__mro__):
                for field, annotation in getattr(base, "__annotations__", {}).items():
                    if field.startswith("_"):
                        continue
                    setattr(self, field, _zero_for(annotation))
            return written(self, *args, **kwargs)

        start.genlayer_wrapped = True
        cls.__init__ = start


class _Vm:
    UserError = UserError
    Return = Return
    Rollback = Rollback

    @staticmethod
    def run_nondet_unsafe(leader_fn, validator_fn):
        """Run the leader, then make the validator sign it or reject it."""
        try:
            value = leader_fn()
        except Exception as leader_error:  # the leader fell over
            if not validator_fn(leader_error):
                raise Rollback("the round did not agree on the leader's error")
            raise
        if not validator_fn(Return(value)):
            raise Rollback("the round did not agree with the leader")
        return value

    @staticmethod
    def run_nondet(leader_fn, validator_fn, **kwargs):
        return _Vm.run_nondet_unsafe(leader_fn, validator_fn)


class _EqPrinciple:
    @staticmethod
    def strict_eq(fn):
        return fn()


# Payouts the contract made, newest last: (address hex, amount).
transfers: list = []


class _Evm:
    @staticmethod
    def contract_interface(cls):
        class _Interface:
            def __init__(self, address):
                self.address = Address(address)

            def emit_transfer(self, value):
                transfers.append((self.address.as_hex, int(value)))

        _Interface.__name__ = cls.__name__
        _Interface.__qualname__ = cls.__qualname__
        return _Interface


class _Gl:
    Contract = Contract
    public = _PublicMarkers()
    vm = _Vm()
    evm = _Evm()
    storage = _Storage()
    eq_principle = _EqPrinciple()

    def __init__(self):
        self.message = _Message()
        self.message_raw = {"datetime": "2026-05-02T09:00:00.000000Z"}
        self.nondet = _Nondet()

    def set_message(self, sender: str, value: int = 0) -> None:
        self.message = _Message()
        self.message.sender_address = Address(sender)
        self.message.origin_address = Address(sender)
        self.message.value = int(value)

    def set_clock(self, epoch: int) -> None:
        stamp = datetime.datetime.fromtimestamp(
            int(epoch), datetime.timezone.utc
        ).strftime("%Y-%m-%dT%H:%M:%S")
        self.message_raw = {"datetime": stamp + ".000000Z"}


gl = _Gl()
