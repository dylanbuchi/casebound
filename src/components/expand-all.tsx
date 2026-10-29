"use client";

import { useEffect, useState } from "react";

const sections = () => Array.from(document.querySelectorAll<HTMLDetailsElement>("main details"));

// Opens or closes every collapsible section on the case page in one click. The label follows the page:
// "Collapse all" only once every section is open, so opening one by hand never leaves it saying the wrong thing.
export function ExpandAll() {
  const [allOpen, setAllOpen] = useState(false);
  useEffect(() => {
    const sync = () => {
      const all = sections();
      setAllOpen(all.length > 0 && all.every((d) => d.open));
    };
    sync();
    // "toggle" does not bubble, so listen in the capture phase to hear every section.
    document.addEventListener("toggle", sync, true);
    return () => document.removeEventListener("toggle", sync, true);
  }, []);
  const toggle = () => {
    const next = !allOpen;
    sections().forEach((d) => {
      d.open = next;
    });
  };
  return (
    <button type="button" onClick={toggle} className="ml-auto inline-grid text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
      {/* Both labels share one cell, so the button keeps its width when the label changes. */}
      <span className={`col-start-1 row-start-1 ${allOpen ? "invisible" : ""}`}>Expand all</span>
      <span className={`col-start-1 row-start-1 ${allOpen ? "" : "invisible"}`}>Collapse all</span>
    </button>
  );
}
