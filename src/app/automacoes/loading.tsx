import { WorkOpeningSkeleton } from "@/components/WorkOpeningSkeleton";
import { COPY } from "@/lib/copy";

export default function AutomacoesLoading() {
  return <WorkOpeningSkeleton label={COPY.automacoesOpening} split />;
}
