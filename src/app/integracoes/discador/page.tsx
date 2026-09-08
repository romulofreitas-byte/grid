import { integracoesHref } from "@/lib/back";
import { redirect } from "next/navigation";

export default function IntegracoesDiscadorRedirectPage() {
  redirect(integracoesHref("dialer"));
}
