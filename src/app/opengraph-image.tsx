import { ImageResponse } from "next/og";
import { PRODUCT } from "@/lib/brand";

// The card shown when a link to the app is shared.
export const alt = `${PRODUCT}: an AI case worker for PayPal disputes`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1b1a17"/><path d="M43.3 20.7 A16 16 0 1 0 43.3 43.3" fill="none" stroke="#f4efe6" stroke-width="7.5" stroke-linecap="round"/><path d="M35 32.5 L40.5 38 L52 26" fill="none" stroke="#6cc08a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#f4efe6",
          color: "#1b1a17",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(mark)}`} width={128} height={128} alt="" />
        <div style={{ marginTop: 40, fontSize: 92, fontWeight: 700, letterSpacing: -2 }}>{PRODUCT}</div>
        <div style={{ marginTop: 16, fontSize: 40, color: "#57524a", maxWidth: 960 }}>
          An AI case worker for PayPal disputes. It investigates, does the math and drafts the reply. You approve.
        </div>
      </div>
    ),
    size,
  );
}
