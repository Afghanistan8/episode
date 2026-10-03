# Episode

## Who it is for

Episode is for sponsors who fund visible-event programmes and claimants who
need a loss read fairly. It serves gala venues, ports and logistics desks,
property operators, insurers, and funds. The supported categories remain
property damage, vehicle damage, cargo damage or loss, and visible business
interruption.

## What a programme locks

A programme locks its category, event definition, exclusions, criteria,
required evidence, award, claimant stake, evidence window, and appeal window.
The sponsor funds its reserve when opening it. Published versions are immutable,
and every filing keeps the version it entered under.

## What a filing carries

A filing carries the named subject, identifier, event date, declared cause,
stake, scene photographs, and any required document. Missing evidence is named
before a panel is called. Validators rate what appears in the frames, grounding
each rating on a frame they saw or an assessor's note. The stored ratings always
seal the same finding and receipt under the contract rules.

## Where the live market is

The live market is on GenLayer Studionet:

```text
chain: 61999
RPC: https://studio.genlayer.com/api
contract: 0x9e6985b530A0c422E876C773b2d8b4e58E20b4f5
```

The deployed market and its funded programmes are documented in
[`docs/live-market.md`](docs/live-market.md). The web app reads that address
directly and Vercel builds from `web/` with these public values:

```text
NEXT_PUBLIC_EPISODE_CHAIN_ID=61999
NEXT_PUBLIC_EPISODE_RPC=https://studio.genlayer.com/api
NEXT_PUBLIC_EPISODE_CONTRACT=0x9e6985b530A0c422E876C773b2d8b4e58E20b4f5
NEXT_PUBLIC_EPISODE_FIXTURES=0
```

For local work:

```bash
npm install
cd web
npm install
npm test
npm run dev
```

Deployment and seed scripts accept a funded signing key only through the
`EPISODE_PRIVATE_KEY` process environment variable. The browser app never needs
that key, and it must not be stored in a file.
