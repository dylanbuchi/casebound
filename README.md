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

- Model: set by `AI_MODEL`. The demo runs Claude Opus 5.5 (`claude-opus-5-5`); development uses Claude Haiku 5.5. Calls go through the Anthropic TypeScript SDK tool runner with adaptive thinking, prompt caching, and server-side refusal fallback where the model supports it.
- Cost guard: `AI_DAILY_CAP` limits analyses per day, and saved analyses are reused.
- Tools: eight read-only investigation tools (including the evidence checklist and an economics calculator) plus one strict-schema `record_assessment` tool. The agent cannot move money; actions are built on the server from the seller's approval.
- Buyer messages are treated as untrusted data in the system prompt.

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
4. Open the dispute: on `/store/orders`, click "Buyer opens dispute" (uses the app's sandbox `disputes/create` scope on the buyer's behalf). Or log in to `https://www.sandbox.paypal.com` as the buyer, open the payment under Activity, and choose Report a problem.
5. Refresh the inbox.

## Tests

```bash
pnpm test
```

## License

Copyright (c) 2026 Dylan Buchi. Licensed under the GNU Affero General Public License v3.0 (`AGPL-3.0-only`). See [LICENSE](LICENSE). If you run a modified version as a network service, the AGPL requires you to publish your changes.
