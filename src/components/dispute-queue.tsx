"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

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
  rowHeight: 52,
});

const verdictClass = { FIGHT: "text-fight", ACCEPT: "text-accept", OFFER: "text-offer" } as const;

function Verdict({ value, data }: ICellRendererParams<QueueRow, QueueRow["verdict"]>) {
  if (!value && data?.quickCall && data.needsResponse) return <span className="text-accept">Quick call: accept</span>;
  if (!value) return <span className="text-ink-3">Not analyzed</span>;
  return <span className={`stamp text-[11px] ${verdictClass[value]}`}>{value}</span>;
}

const money = (v: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);

export function DisputeQueue({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const columns = useMemo<ColDef<QueueRow>[]>(
    () => [
      {
        field: "dueInDays",
        headerName: "Due",
        width: 110,
        sort: "asc",
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
      { field: "reason", headerName: "Reason", flex: 1.4, minWidth: 170 },
      { field: "stage", headerName: "Stage", width: 120, valueFormatter: (p) => String(p.value).toLowerCase() },
      { field: "status", headerName: "Status", flex: 1, minWidth: 160 },
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
        headerName: "Fight vs refund",
        width: 150,
        type: "rightAligned",
        headerTooltip: "Expected money saved by fighting instead of refunding. Negative means refunding is cheaper.",
        valueFormatter: (p) => (p.value === null ? "-" : `${p.value >= 0 ? "+" : ""}${money(p.value, p.data?.currency)}`),
        cellClass: (p) => `font-mono ${p.value === null ? "" : p.value >= 0 ? "text-accept" : "text-ink-2"}`,
      },
    ],
    [],
  );

  return (
    <div className="h-[420px] w-full">
      <AgGridReact<QueueRow>
        theme={theme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={{ sortable: true, resizable: true, filter: true }}
        getRowId={(p) => p.data.id}
        onRowClicked={(e) => e.data && router.push(`/disputes/${encodeURIComponent(e.data.id)}`)}
        onCellKeyDown={(e) => {
          const ev = e.event as KeyboardEvent | undefined;
          if (ev?.key === "Enter" && e.data) router.push(`/disputes/${encodeURIComponent(e.data.id)}`);
        }}
        rowClass="cursor-pointer"
        overlayNoRowsTemplate="No disputes yet. Open one from the sandbox buyer account."
      />
    </div>
  );
}
