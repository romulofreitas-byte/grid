import { ImageResponse } from "next/og";

export const alt = "GRID · Mundo Pódium";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SLOTS = [
  { x: 14, y: 99.54, fill: "#F5B301" },
  { x: 54, y: 99.54, fill: "#FFFFFF" },
  { x: 40.84, y: 61.54, fill: "#FFFFFF" },
  { x: 80.84, y: 61.54, fill: "#FFFFFF" },
  { x: 67.68, y: 23.54, fill: "#FFFFFF" },
  { x: 107.68, y: 23.54, fill: "#FFFFFF" },
] as const;

async function loadSora(weight: 600 | 800) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Sora:wght@${weight}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
      },
    },
  ).then((res) => res.text());
  const match = /src: url\(([^)]+)\)/.exec(css);
  if (!match) {
    throw new Error(`Could not load Sora ${weight}`);
  }
  return fetch(match[1]).then((res) => res.arrayBuffer());
}

export default async function Image() {
  const [sora800, sora600] = await Promise.all([
    loadSora(800),
    loadSora(600),
  ]);

  const mark = 196;
  const k = mark / 153.08;
  const slotW = 26 * k;
  const slotH = 30 * k;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0B1A2E",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: mark,
              height: mark,
              display: "flex",
              position: "relative",
            }}
          >
            {SLOTS.map((slot) => (
              <div
                key={`${slot.x}-${slot.y}`}
                style={{
                  position: "absolute",
                  left: slot.x * k,
                  top: slot.y * k,
                  width: slotW,
                  height: slotH,
                  backgroundColor: slot.fill,
                  transform: "skewX(-10.2deg)",
                  transformOrigin: "0% 100%",
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              marginLeft: 28,
              height: mark,
            }}
          >
            <div
              style={{
                color: "#FFFFFF",
                fontFamily: "Sora",
                fontSize: 102,
                fontWeight: 800,
                lineHeight: 0.9,
                letterSpacing: -3,
              }}
            >
              GRID
            </div>
            <div
              style={{
                color: "#7A8494",
                fontFamily: "Sora",
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: 6,
                marginTop: 14,
                textTransform: "uppercase",
              }}
            >
              Mundo Pódium
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Sora", data: sora800, style: "normal", weight: 800 },
        { name: "Sora", data: sora600, style: "normal", weight: 600 },
      ],
    },
  );
}
