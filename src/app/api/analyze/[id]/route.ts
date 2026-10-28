import { analyzeDispute, type AgentEvent } from "@/lib/agent";
import { isUnlocked } from "@/lib/auth";
import { env } from "@/lib/env";
import { clientIp, concurrencyGate, rateLimiter } from "@/lib/limits";
import { claimAnalysisSlot, saveAnalysis } from "@/lib/records";
import { source } from "@/lib/source";

export const maxDuration = 300;

// One analysis at a time per dispute; a double click must not bill twice.
const running = new Set<string>();
// Per process, so they reset on restart; the Anthropic console spend limit is the hard backstop.
const gate = concurrencyGate(2);
const perIp = rateLimiter(5, 60 * 60 * 1000);

// Streams the agent's progress as newline-delimited JSON, then the final result.
export async function POST(req: Request, ctx: RouteContext<"/api/analyze/[id]">) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) return Response.json({ error: "Invalid dispute id" }, { status: 400 });
  if (!(await isUnlocked())) return Response.json({ error: "Enter the passcode to run analyses." }, { status: 401 });
  if (!env.anthropicConfigured) return Response.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 503 });
  if (running.has(id)) return Response.json({ error: "An analysis is already running." }, { status: 409 });
  if (!gate.tryEnter()) return Response.json({ error: "Two analyses are already running. Try again in a minute." }, { status: 429 });
  const ip = perIp.take(clientIp(req.headers));
  if (!ip.ok) {
    gate.leave();
    return Response.json(
      { error: `Too many analyses from your network. Try again in ${Math.ceil(ip.retryMs / 60000)} min.` },
      { status: 429 },
    );
  }
  running.add(id);
  const slot = await claimAnalysisSlot();
  if (!slot.ok) {
    running.delete(id);
    gate.leave();
    return Response.json(
      { error: `Today's limit of ${slot.cap} AI analyses is used up. Saved analyses still work; try again tomorrow.` },
      { status: 429 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await analyzeDispute(source(), id, (e: AgentEvent) => send(e));
        await saveAnalysis(result);
        send({ type: "done" });
      } catch (e) {
        console.error("analysis failed", id, e);
        send({ type: "error", message: e instanceof Error ? e.message : "Analysis failed" });
      } finally {
        running.delete(id);
        gate.leave();
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
