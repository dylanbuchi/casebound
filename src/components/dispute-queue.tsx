"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fightSavings } from "@/lib/format";

ModuleRegistry.registerModules([AllCommunityModule]);

export type QueueRow = {
  id: string;
  amount: number;
  currency: string;
  reason: string;
  stage: string;
  status: string;
  needsResponse: boolean;
  dueInDays: number | null;
  verdict: "FIGHT" | "ACCEPT" | "OFFER" | null;
  quickCall: boolean;
  // Refunded through the quick call, so there is no AI analysis to show.
  quickAccepted: boolean;
  practice: boolean;
  winProbability: number | null;
  savings: number | null;
};

const theme = themeQuartz.withParams({
  fontFamily: "var(--font-plex-sans)",
  headerFontFamily: "var(--font-plex-mono)",
  headerFontSize: 11,
  backgroundColor: "#fbf8f2",
  foregroundColor: "#1b1a17",
  headerBackgroundColor: "#ebe4d6",
  borderColor: "#d8cfbf",
  rowHoverColor: "#f1ebdf",
  selectedRowBackgroundColor: "#efe6d3",
  accentColor: "#1f4fa8",
  wrapperBorderRadius: 8,
  rowHeight: 56,
  fontSize: 15,
});

const verdictClass = { FIGHT: "bg-fight", ACCEPT: "bg-accept", OFFER: "bg-offer" } as const;

function Verdict({ value, data }: ICellRendererParams<QueueRow, QueueRow["verdict"]>) {
  if (!value && data?.quickCall && data.needsResponse) return <span className="text-accept">Quick call: refund</span>;
  if (!value && data?.quickAccepted) return <span className="text-accept">Quick call: refunded</span>;
  if (!value) return <span className="text-ink-3">Not analyzed</span>;
  return (
    <span className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-paper ${verdictClass[value]}`}>{value}</span>
  );
}

const caseHref = (id: string) => `/disputes/${encodeURIComponent(id)}`;

const money = (v: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);

export function DisputeQueue({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  // The grid's script arrives after the page; hold its place so the inbox does not look empty meanwhile.
  const [ready, setReady] = useState(false);
  const columns = useMemo<ColDef<QueueRow>[]>(
    () => [
      {
        field: "dueInDays",
        headerName: "Due",
        width: 110,
        sort: "asc",
        // Cases with no deadline (resolved or under review) sort after the ones waiting on you.
        comparator: (a: number | null, b: number | null) => (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER),
        valueFormatter: (p) => (p.value === null ? "-" : p.value <= 0 ? "Today" : `${p.value} days`),
        cellClass: (p) => (p.data?.needsResponse && (p.value ?? 99) <= 3 ? "text-fight font-semibold" : ""),
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 120,
        type: "rightAligned",
        valueFormatter: (p) => money(p.value, p.data?.currency),
        cellClass: "font-mono",
      },
      {
        field: "reason",
        headerName: "Reason",
        flex: 1.4,
        minWidth: 190,
        // A real link, so the case opens in a new tab on middle-click and reads as a link to screen readers.
        cellRenderer: (p: ICellRendererParams<QueueRow, string>) => (
          <span>
            {p.data ? (
              <Link href={caseHref(p.data.id)} className="underline-offset-4 hover:underline focus-visible:underline">
                {p.value}
              </Link>
            ) : (
              p.value
            )}
            {p.data?.practice && (
              <span className="ml-2 rounded-full border border-offer px-2 py-0.5 text-[11px] font-medium text-offer">Practice</span>
            )}
          </span>
        ),
      },
      { field: "stage", headerName: "Stage", width: 120, valueFormatter: (p) => String(p.value).toLowerCase() },
      { field: "status", headerName: "Status", flex: 1, minWidth: 140 },
      { field: "verdict", headerName: "Recommendation", width: 160, cellRenderer: Verdict },
      {
        field: "winProbability",
        headerName: "Win odds",
        width: 110,
        type: "rightAligned",
        valueFormatter: (p) => (p.value === null ? "-" : `${Math.round(p.value * 100)}%`),
        cellClass: "font-mono",
      },
      {
        field: "savings",
        headerName: "Fighting saves (avg)",
        width: 170,
        type: "rightAligned",
        headerTooltip:
          "Expected money saved by fighting instead of refunding, on average. Negative means refunding is cheaper. Green only when fighting is also the pick.",
        valueFormatter: (p) => fightSavings(p.value, p.data?.verdict ?? null, p.data?.currency).text,
        cellClass: (p) => `font-mono ${fightSavings(p.value, p.data?.verdict ?? null).good ? "text-accept" : "text-ink-2"}`,
      },
    ],
    [],
  );

  return (
    <div className="relative w-full">
      {!ready && <GridPlaceholder rows={rows.length} />}
      <div className={ready ? "" : "invisible absolute inset-x-0 top-0"}>
        <AgGridReact<QueueRow>
          theme={theme}
          rowData={rows}
          domLayout="autoHeight"
          columnDefs={columns}
          defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }}
          getRowId={(p) => p.data.id}
          onFirstDataRendered={() => setReady(true)}
          onRowClicked={(e) => {
            const ev = e.event as MouseEvent | null | undefined;
            // The reason link handles its own clicks, including ctrl/cmd-click into a new tab.
            if (!e.data || (ev?.target as Element | null)?.closest("a") || ev?.ctrlKey || ev?.metaKey || ev?.shiftKey) return;
            router.push(caseHref(e.data.id));
          }}
          onCellKeyDown={(e) => {
            const ev = e.event as KeyboardEvent | undefined;
            if (ev?.key === "Enter" && e.data) router.push(caseHref(e.data.id));
          }}
          rowClass="cursor-pointer"
          overlayNoRowsTemplate="No disputes yet. Open one from the sandbox buyer account."
        />
      </div>
    </div>
  );
}

// Same height as the grid it stands in for (header plus one 56px row per case), so nothing jumps when it loads.
function GridPlaceholder({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-card" role="status">
      <div className="flex h-12 items-center border-b border-rule bg-paper-2 px-4 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        Loading cases…
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-6 border-b border-rule px-4 last:border-b-0" aria-hidden>
          <span className="h-3 w-14 motion-safe:animate-pulse rounded bg-paper-2" />
          <span className="h-3 w-16 motion-safe:animate-pulse rounded bg-paper-2" />
          <span className="h-3 flex-1 motion-safe:animate-pulse rounded bg-paper-2" />
          <span className="h-3 w-24 motion-safe:animate-pulse rounded bg-paper-2" />
        </div>
      ))}
    </div>
  );
}
