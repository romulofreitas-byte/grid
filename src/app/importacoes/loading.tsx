import { WorkOpeningSkeleton } from "@/components/WorkOpeningSkeleton";
import { COPY } from "@/lib/copy";

export default function ImportacoesLoading() {
  return <WorkOpeningSkeleton label={COPY.importacoesOpening} split />;
}
