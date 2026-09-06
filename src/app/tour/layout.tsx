import type { Metadata } from "next";
import type { ReactNode } from "react";
import { COPY } from "@/lib/copy";

export const metadata: Metadata = {
  title: COPY.tourPageTitle,
  description: COPY.landingPromessa,
};

export default function TourLayout({ children }: { children: ReactNode }) {
  return children;
}
