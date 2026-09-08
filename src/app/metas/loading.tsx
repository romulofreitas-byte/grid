import { WorkOpeningSkeleton } from "@/components/WorkOpeningSkeleton";
import { COPY } from "@/lib/copy";

export default function MetasLoading() {
  return <WorkOpeningSkeleton label={COPY.metasOpening} split />;
}
