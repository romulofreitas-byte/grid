import { crmQualifyBridgeTask } from "@/lib/catchup/tasks/crm-qualify-bridge";
import type { CatchUpTask } from "@/lib/catchup/types";

export const CATCHUP_TASKS: CatchUpTask[] = [crmQualifyBridgeTask];
