import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export function GET(req: NextRequest) {
  const size = Math.min(
    512,
    Math.max(16, parseInt(req.nextUrl.searchParams.get("size") ?? "192", 10))
  );
  const r    = Math.round(size * 0.22);
  const font = Math.round(size * 0.56);

  return new ImageResponse(
    (
      <div
        style={{
          width:          size,
          height:         size,
          background:     "linear-gradient(145deg,#0f2410 0%,#1a3a20 100%)",
          borderRadius:   r,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:        font,
        }}
      >
        🚐
      </div>
    ),
    { width: size, height: size }
  );
}
