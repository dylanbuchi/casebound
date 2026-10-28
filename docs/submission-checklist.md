# Pre-submission checklist (Nov 8 to 10)

Deadline: Thu Nov 12, 2026, 12:00 PT (21:00 Geneva). Dylan registers and submits himself.

## Secrets and repo
- [ ] `gitleaks detect --log-opts="--all"` over the full git history is clean.
- [ ] `git log --all -- .env.local .env` shows nothing: `.env.local` was never committed.
- [ ] Only `.env.example` is tracked, with empty values.
- [ ] AGPL-3.0 `LICENSE` shows in the GitHub About section once public.
- [x] Product renamed to Casebound in the app, README, docs and package name ("Dispute Desk" is taken).
- [ ] GitHub repo named `casebound` when it is created. The local folder keeps its old name on purpose.

## Judge access
- [ ] Hosted demo stays up and free to use for judges until Dec 15, 2026, at `casebound.zycody.com` on Render.
- [ ] Hosted demo URL works and shows seeded disputes with saved analyses.
- [ ] The demo passcode and the steps to test are in the README and the Devpost "testing instructions". The passcode becomes public with them, so `AI_DAILY_CAP` stays low on the hosted demo and the PayPal app stays sandbox-only.
- [ ] Setup from a fresh clone works in demo mode with no credentials.

## Video (under 3 minutes, public on YouTube)
- [ ] Shows the full flow end to end: inbox, investigate (live tool steps), money math, approve, PayPal call succeeds, status changes. Judges may score from the video alone.
- [ ] Shows at least one FIGHT, one ACCEPT and one OFFER.
- [ ] No copyrighted music, no third-party trademarks beyond the APIs named factually.
- [ ] Recorded on `AI_MODEL=claude-opus-5-5`.

## Wording
- [ ] Never claims "first" or "no one does this". Commercial dispute tools exist.
- [ ] Names no competitor brand anywhere (rules forbid third-party trademarks without permission). Describe the complaints, not the brands.
- [ ] Positioning: open source to self-host, hosted version at a flat monthly price, no cut of wins, seller in control. No specific price.
- [ ] Says "built on the PayPal REST APIs". Does not claim the Agent Toolkit unless it is actually integrated.
- [ ] Names the AI model and how it is used (Devpost "tools used" field).

## Sponsor prizes
- [ ] Re-read the AG Grid and Render pages. AG Grid rewards AG Studio dashboards and the Studio Agent Framework, not a plain grid. Render rewards deploying on Render and using Render Workflows. Each feature claimed must be visible in the app, README and video.

## Review
- [ ] Full review: security, payments, privacy, wording.
- [ ] Dylan runs `/code-review ultra` himself.
