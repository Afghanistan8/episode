# Episode Assurance Layer

The assurance layer is a new set of four GenLayer Intelligent Contracts. It is
additive: [`contracts/episode.py`](../contracts/episode.py) and the existing
Studionet contract remain unchanged. Episode continues to decide its own
filings, reserve movements, appeals, and withdrawals.

| contract | role | Episode boundary |
| --- | --- | --- |
| `episode_truth.py` | Reads sponsor-approved HTTPS JSON sources and records a consensus corroboration finding. | Reads `programme` and `receipt`; cannot write to Episode. |
| `episode_policy_guard.py` | Produces a structured consensus audit of a published programme version. | Reads `programme_version`; cannot write to Episode. |
| `episode_integrity_graph.py` | Records exact evidence reuse as a review signal. | Reads `receipt` and `filing`; never rejects an Episode filing. |
| `episode_capital_pool.py` | Holds a separately funded native-GEN supplemental benefit. | Reads Episode and the three companion views; never touches Episode's reserve. |

## Settlement boundary

The pool can credit only its own benefit and only when all of these are true:

1. Episode's receipt is final and `ESTABLISHED`.
2. The truth finding is `CORROBORATED`.
3. The integrity signal is `CLEAR`.
4. The exact Episode programme version is `PASS` in the policy guard.
5. This filing has never received that supplemental credit.

All pool payments use a pull ledger. A filed claim, Episode's own money, and
Episode's existing withdrawal path are never changed by this suite.

## Deploy deliberately

Deployment is an external, value-bearing action and is intentionally not run by
the repository scripts automatically. Before deploying, decide the source URLs
for each programme and the configured integrity threshold; there is no hidden default.

```powershell
$env:EPISODE_PRIVATE_KEY = "0x..."
$env:EPISODE_CONTRACT = "0x9e6985b530A0c422E876C773b2d8b4e58E20b4f5"
$env:EPISODE_INTEGRITY_THRESHOLD_BPS = "8800"
npm run deploy:milestone
```

The deployment script compiles each source through GenLayer before it deploys,
deploys dependencies in order, and records addresses in
`.episode-milestone-deploy.json`. Put its four printed addresses in the matching
`NEXT_PUBLIC_EPISODE_*_CONTRACT` values in Vercel, then deploy the frontend.

## Evidence for a milestone submission

Include the four contract addresses, their deployment transaction links, one
configured source policy, one policy review, one indexed filing, and one pool
settlement attempt. The UI exposes these companion results at `/assurance` once
the public addresses are configured.
