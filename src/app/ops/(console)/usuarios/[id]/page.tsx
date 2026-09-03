import { OpsUserSheet } from "@/app/ops/_components/OpsUserSheet";

export default async function OpsUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OpsUserSheet id={id} />;
}
