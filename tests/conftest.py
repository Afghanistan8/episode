"""Loads `contracts/episode.py` against the runtime double in tests/glfake."""

import importlib.util
import pathlib
import sys

import pytest

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE / "glfake"))
sys.path.insert(0, str(HERE))


def _load_contract():
    spec = importlib.util.spec_from_file_location(
        "episode_contract", ROOT / "contracts" / "episode.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["episode_contract"] = module
    spec.loader.exec_module(module)
    return module


episode = _load_contract()


@pytest.fixture
def ep():
    """The contract module, with the double reset between tests."""
    import genlayer

    genlayer.transfers.clear()
    genlayer.gl.nondet = genlayer._Nondet()
    return episode


@pytest.fixture
def court(ep):
    from helpers import Court

    return Court(ep)
