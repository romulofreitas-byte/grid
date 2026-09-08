import { integracoesHref } from "@/lib/back";
import { redirect } from "next/navigation";

export default function IntegracoesVoipRedirectPage() {
  redirect(integracoesHref("voip"));
}
