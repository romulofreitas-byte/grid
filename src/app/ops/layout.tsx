import type { Metadata } from "next";
import { RaceAtmosphere } from "@/components/RaceAtmosphere";

export const metadata: Metadata = {
  title: "Ops · GRID",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default function OpsRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen text-podium-white">
      <RaceAtmosphere />
      {children}
    </div>
  );
}
