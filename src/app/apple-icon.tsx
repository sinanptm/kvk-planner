import { ImageResponse } from "next/og";

// Home-screen icon for iPhones: the same crown as the favicon, on a full square (iOS rounds the corners).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const crown = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#e0343d" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={112} height={112} alt="" src={`data:image/svg+xml;base64,${Buffer.from(crown).toString("base64")}`} />
      </div>
    ),
    size,
  );
}
