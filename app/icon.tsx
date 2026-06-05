import { ImageResponse } from "next/og";

export const size        = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:          32,
          height:         32,
          background:     "#0d1a0b",
          borderRadius:   7,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       20,
        }}
      >
        🚐
      </div>
    ),
    { ...size }
  );
}
