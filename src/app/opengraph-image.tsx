import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { company } from "@/lib/site-content";

// Default link preview for any page without its own image (the homepage,
// legal pages, stores without a logo). Uses the built-in font, so no font
// files are needed.

export const alt = `${company.name}: storage, fulfillment and delivery across Abuja, Lagos and the USA`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const png = await readFile(join(process.cwd(), "public/brand/bnp-icon.png"));
  const icon = `data:image/png;base64,${png.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f2a44",
          padding: "72px 80px",
          color: "#f8f5f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} width={88} height={88} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 44, fontWeight: 700 }}>{company.name}</div>
            <div style={{ fontSize: 20, letterSpacing: 4, color: "#3aa0b2" }}>OPERATIONS PARTNER</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 960 }}>
            {company.tagline}
          </div>
          <div style={{ fontSize: 30, color: "#8a97a8", maxWidth: 940 }}>
            We store your inventory, fulfil your orders and deliver to your customers.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 26 }}>
          {company.locations.map((loc) => (
            <div key={loc} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: "#e8a020" }} />
              {loc}
            </div>
          ))}
          <div style={{ marginLeft: "auto", color: "#e8a020", fontWeight: 700 }}>
            {company.website}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
