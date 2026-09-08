import { WorkOpeningSkeleton } from "@/components/WorkOpeningSkeleton";
import { COPY } from "@/lib/copy";

export default function ListasLoading() {
  return <WorkOpeningSkeleton label={COPY.listasOpening} split />;
}
