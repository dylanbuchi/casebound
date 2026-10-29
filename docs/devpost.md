# Devpost submission copy

## Project name
Casebound

## Tagline (elevator pitch)
An AI dispute desk for PayPal sellers: it investigates each dispute, does the money math, changes its mind when the evidence says so, and drafts the reply. Nothing is sent until you approve.

## Links
- Live demo (PayPal sandbox): https://casebound.zycody.com
- Code: https://github.com/dylanbuchi/casebound
- Video: https://www.youtube.com/watch?v=-nJ69pXJ5SY

## Built with
paypal, paypal-disputes-api, paypal-orders-api, paypal-js-sdk, claude, anthropic, typescript, next.js, react, tailwindcss, ag-grid, vitest, render, cloudflare

## Story

### Inspiration
Every PayPal dispute is a deadline with money on the line. Miss it and you lose by default. Small online sellers face the same three questions every time: is this worth fighting, what evidence do I have, and what do I say? Gathering the dispute, the payment, the tracking and the shop records by hand takes most of an hour, so many sellers either refund everything or fight blindly. We wanted a desk that does the casework and leaves the decision with the seller.

### What it does
Casebound pulls disputes from PayPal and shows what is at risk and how many days are left.

- **Quick call, no AI needed.** Tiny disputes, like a $6 duplicate charge, cost more to fight than to refund even at 90% win odds. Casebound says so with plain math and offers a one-click refund, at zero AI cost.
- **A Claude agent investigates the rest.** It reads the dispute on PayPal, the capture and order, PayPal shipment tracking, the shop's fulfillment record, the store policy and the buyer's history, through read-only tools.
- **It changes its mind, visibly.** The agent records a working lean as it goes. In the demo it leans toward fighting because the shop record says "delivered, signed by R. Diaz", then PayPal tracking shows the parcel was RETURNED, and it switches to accept and explains why.
- **Money math done in code, not by the model.** Expected value of fighting vs refunding, including the dispute fee and the seller's time, with the break-even win rate.
- **Grounded drafts.** Every claim in the draft response is checked in code against the records. Unsupported claims are sent back to the agent for a rewrite before the seller sees them.
- **You approve every send.** Casebound plans the exact PayPal call (accept claim, provide evidence, make an offer, send a message), shows the request, asks for confirmation, and keeps a receipt in the audit log.

### How we built it
- Next.js 16 and TypeScript, with a Claude agent built on the Anthropic SDK tool runner: 8 read-only investigation tools plus tools to record a working hypothesis and the final assessment.
- PayPal Disputes API (list, read, accept claim, provide evidence, provide supporting info, make offer, send message), Orders v2 and Captures, shipment trackers, and the PayPal JS SDK for the demo store's checkout.
- The economics and the evidence checklist are deterministic code; the model never does the arithmetic it is graded on.
- Practice cases use the exact shape of the PayPal sandbox responses, so practice and live share one code path. Sends on practice cases are simulated and labeled.
- Deployed on Render with Cloudflare DNS.

### Challenges we ran into
- **Keeping the AI honest.** Early drafts claimed things the records did not show. We added code-enforced grounding: dates, tracking numbers, signatures and IDs in the draft must match a source, or the claim is rewritten.
- **Stale decisions.** If a dispute changes on PayPal after the analysis, the old plan must not be sent. Sends are blocked until a re-analysis, and the server rebuilds every PayPal request instead of trusting the browser.
- **Safety for a public demo.** A passcode with signed, expiring cookies, rate limits on passcode tries and AI runs, a daily AI budget, and prompt-injection tests on buyer messages.
- **Creating realistic disputes in the sandbox** took a dedicated demo store and test buyers.

### Accomplishments that we're proud of
- The visible change of mind: the agent shows its reasoning shifting when the evidence contradicts the shop's own record.
- It works end to end on real PayPal sandbox disputes, with every request and PayPal's reply in the audit log.
- Quality checks you can run: 73 automated tests, AI evals on 21 synthetic cases (20/21), 15 held-out messy cases (12/15) and prompt-injection cases (2/2), plus a security review and a multi-agent code review with fixes.

### What we learned
The most useful AI move is often "don't use AI": tiny disputes are better served by plain math. And trust comes from showing the work: the evidence, the odds, the money and the exact request, with a human approving the send.

### What's next for Casebound
A pilot with real sellers on live PayPal accounts, webhooks for instant dispute alerts, carrier tracking lookups beyond PayPal's tracker data, and support for more dispute reasons and marketplaces.

## Testing instructions (for judges)
1. Open https://casebound.zycody.com. The free host may take up to 50 seconds to wake up on the first visit.
2. Reading cases is open to everyone. To run the AI and send responses, click "Unlock" and enter the passcode: **[PASSCODE]**
3. Start with the practice cases (marked "Practice"; sends are simulated and never reach PayPal):
   - the $6 "Duplicate charge" shows the no-AI quick call;
   - the $210 "Item not received" (Rosa Diaz) shows the agent changing its mind. Click "Investigate this dispute" (about 60 seconds), then review and approve. "Reset practice case" puts it back.
4. Cases starting with PP-R are real PayPal sandbox disputes; their receipts in the Audit log show the exact request and PayPal's reply.
