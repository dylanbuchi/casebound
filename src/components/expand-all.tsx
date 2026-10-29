"use client";

import { useState } from "react";

// Opens or closes every collapsible section on the case page in one click.
export function ExpandAll() {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    const next = !open;
    document.querySelectorAll("main details").forEach((d) => {
      (d as HTMLDetailsElement).open = next;
    });
    setOpen(next);
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={open} className="ml-auto text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
      {open ? "Collapse all" : "Expand all"}
    </button>
  );
}
