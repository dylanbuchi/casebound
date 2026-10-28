# Dispute Desk

> Working name. A Zycody product.

An AI case worker for PayPal disputes. Dispute Desk reads each dispute, investigates it through the PayPal APIs and the shop's own records, works out whether fighting is worth the money, and drafts the response. The seller reviews and clicks send. Nothing moves without them.

Built for the PayPal AI Hackathon (2026). Sandbox only.

## Why

Small sellers lose disputes by default. Answering one means digging up the order, the tracking and the messages, guessing whether it is worth fighting, and writing a response before the deadline. Many never answer, and some fight $12 disputes that cost more in time and fees than the refund.

Sellers who already use dispute tools tell the same story: fees taken on disputes they would have won anyway, charges when nothing was filed, no say in which disputes get answered, and generic AI responses. Dispute Desk takes a different angle:

- **Decides, not just contests.** Fight, accept, or offer a refund or replacement, based on the expected cost of each, with the math shown.
- **Seller in control.** The agent investigates and drafts; one click by the seller and it executes through the PayPal Disputes API.
- **Built directly on PayPal's REST APIs** for disputes, payments, orders and shipment tracking.
- **Open source, with a hosted version at a flat monthly price.** Self-host it, or let us run it. No cut of your wins, and you stay in control.

## What it does

1. **Inbox.** Pulls open disputes from the PayPal Disputes API into an AG Grid queue sorted by deadline, with money at risk and the agent's recommendation per dispute.
2. **Investigate.** A Claude agent calls read-only tools: the PayPal dispute, the capture and order (Payments v2, Orders v2), shipment tracking, the shop's fulfillment record, the buyer's history and the store policy. You watch each step stream in.
3. **Deadline and evidence gaps.** A countdown from the dispute's own due date, and a checklist per reason code (item not received, not as described, unauthorized, refund not processed, digital goods) marking each piece of evidence as on file, weak, or missing, such as a missing signature on a high-value order.
4. **Decide with real math.** The agent estimates win odds with reasons. Code, not the model, turns that into an expected cost of fighting vs refunding, including the dispute fee and the seller's time, and shows the break-even odds.
   Tiny disputes get a "quick call" with no AI run: when refunding is cheaper even at 90% win odds, Dispute Desk says so and offers a one-click accept.
5. **Draft.** The agent drafts the evidence response to PayPal and a message to the buyer. Tracking numbers and refund IDs are taken from shop records, never from model text.
6. **Approve and send.** The seller edits the wording and sees the exact PayPal request before approving. Nothing is ever sent automatically. Dispute Desk then calls `provide-evidence`, `accept-claim`, `make-offer` or `send-message` on the PayPal Disputes API, with idempotent request IDs, and keeps a receipt of each request and PayPal's response.

A small demo store (Lumen & Loom, a fictional shop) creates real sandbox payments with PayPal Checkout, and seller tools attach tracking through the Shipment Tracking API, so disputes can be opened against real sandbox transactions.

## PayPal APIs used

| Area | Endpoints |
| --- | --- |
| Disputes v1 | list, show, provide-evidence, accept-claim, make-offer, send-message |
| Payments v2 | show capture |
| Orders v2 | create, capture, show |
| Orders v2 tracking | add tracker to a capture, read trackers on the order |
| JavaScript SDK | PayPal Checkout buttons in the demo store |
| OAuth 2.0 | client credentials with token caching |

## AI

- Model: set by `AI_MODEL`, default `claude-haiku-5-5`. Local development, the saved analyses in `seed/` and the eval all use Claude Haiku 5.5. For the hosted demo, set `AI_MODEL=claude-opus-5-5` on the host to use Claude Opus 5.5. Every analysis records the model that made it, and the case page shows it. Calls go through the Anthropic TypeScript SDK tool runner with adaptive thinking, prompt caching, and server-side refusal fallback where the model supports it.
- Cost guard: `AI_DAILY_CAP` limits analyses per day, and saved analyses are reused.
- Tools: eight read-only investigation tools (including the evidence checklist and an economics calculator) plus one strict-schema `record_assessment` tool. The agent cannot move money; actions are built on the server from the seller's approval.
- Buyer messages are treated as untrusted data in the system prompt.
- Source check (`src/lib/grounding.ts`): code checks three kinds of claim in the summary, the reasoning, both drafts and the evidence list. A delivery claim needs a delivery on file, and a carrier delivery claim needs a PayPal tracker marked DELIVERED. A signature needs a signer in the shop record and is never credited to the carrier. A reference number must appear in PayPal or the shop record. Hedged sentences are skipped. The agent gets one chance to rewrite; anything still unsupported is cut and shown to the seller. Other statements are not checked by code.

## Accuracy (synthetic eval, not a merchant pilot)

`pnpm eval` runs 21 made-up disputes through the same `analyzeDispute` the app uses, against an in-memory source that can never send anything. Full table in [eval/results.md](eval/results.md).

| | Result |
|---|---|
| Right call | **20 of 21 (95%)**; the agent alone got 17 of 18 |
| Quick calls | 3 of 3 small disputes ($4 to $6) settled in code, no AI, $0 |
| Cost | **$0.085** for the whole run on Claude Haiku 5.5, from the API's token counts |
| Time | median **30 s** per case, plus about 6 min to review, against an estimated 45 min by hand |
| Source check | 13 claims sent back for a rewrite, 3 cut in code |
| Changed its mind | 2 cases, both where PayPal tracking contradicted the shop record |

Method and limits:

- The cases cover all five PayPal reasons: strong, weak and contradicted evidence, plus quick calls. The right action for each was written in [eval/dataset.ts](eval/dataset.ts) before the first run. Where two actions are fair (for example offer or refund on a cracked lamp), both count.
- The one miss: an unauthorised charge on a first order to a freight forwarder. The agent chose to fight at only 25% odds, where refunding is the safer call.
- The 45 minutes by hand is an assumption about how long a seller takes to gather records and write a response. It was not measured.
- The cases are synthetic and were written by the same team that built the agent. This shows the pipeline behaves sensibly, not that real merchants win more disputes.

## Held-out eval (messy cases written apart from the prompt)

`EVAL_SET=heldout pnpm eval` runs 15 messier disputes from [eval/heldout.ts](eval/heldout.ts): missing or partial tracking, foreign carriers (Swiss Post, Deutsche Post, La Poste, Royal Mail, Poste Italiane), buyer messages in German, French and Italian, empty or contradictory shop records, duplicate charges, and partial refunds already paid. Full table in [eval/heldout-results.md](eval/heldout-results.md).

| | Result |
|---|---|
| Right call | **12 of 15 (80%)**, lower than the first set |
| Cost | **$0.089** for the whole run on Claude Haiku 5.5, from the API's token counts |
| Time | median **41 s** per case |
| Source check | 7 claims sent back for a rewrite, 0 cut in code |

How it was kept honest:

- A separate agent wrote the cases, the right action and a one-line reason for each, from the dispute side only. It did not see the agent prompt, the checklist, the economics code or the first eval set.
- The labels were committed before the first run. This is the first and only score: the prompt was not changed for this set.

The three misses:

- **HO-10, a real duplicate charge.** One order was captured twice and the shop's notes say so. The agent chose to fight at 55% odds. This is the most serious miss: it would argue against a refund the buyer is owed.
- **HO-04, Royal Mail with no delivery scan** on an order over the signature limit. The agent made an offer at 10% odds; a full refund was the expected call, since nothing shows the parcel arrived.
- **HO-11, a refund minus the return label**, issued within the return policy. The agent made an offer; the label expected fighting with proof of the refund. This one is closer to a judgment call.

Still synthetic, still not a merchant pilot: it shows how the agent copes with untidy input, not how often real sellers win.

## Run it

Requirements: Node 20+, pnpm.

```bash
pnpm install
cp .env.example .env.local   # fill in what you have
pnpm dev
```

- With no PayPal credentials, the app runs on five bundled demo disputes that use the same data shapes as the sandbox.
- With `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from a PayPal sandbox app, it uses real sandbox disputes.
- `ANTHROPIC_API_KEY` is needed to run the analysis.
- Set `APP_PASSCODE` on any public deploy: it gates analyses (which cost API credits), sending, and the store tools.

### Create a sandbox dispute

1. In the PayPal developer dashboard, open Sandbox accounts and note the personal (buyer) account login.
2. Open `/store`, buy an item with that buyer account.
3. Open `/store/orders` and stage what happened: ship tracked or untracked, mark delivered.
4. Log in to `https://www.sandbox.paypal.com` as the buyer, open the payment under Activity, and choose Report a problem. (Creating disputes through the API needs a buyer-side permission PayPal does not grant this app, so the Resolution Center is the supported path.)
5. Wait a minute or two: PayPal moves new disputes into a state the seller can answer, then the inbox shows them.

## Hosting the demo

- Disputes always come live from PayPal. Shop records, saved analyses and receipts live in JSON files under `DATA_DIR`.
- On hosts with an ephemeral disk (for example Render's free tier), the app falls back to the committed snapshot in `seed/` whenever a data file is missing, so a restart shows the same orders, analyses and receipts. Refresh the snapshot with `node scripts/export-seed.mjs` (it refuses anything that looks like a secret).
- Set `APP_PASSCODE`, and keep `AI_DAILY_CAP` low (30 per day for the public demo). Saved analyses are shown without spending credits.

## Tests

```bash
pnpm test
```

## License

Copyright (c) 2026 Dylan Buchi. Licensed under the GNU Affero General Public License v3.0 (`AGPL-3.0-only`). See [LICENSE](LICENSE). If you run a modified version as a network service, the AGPL requires you to publish your changes.
