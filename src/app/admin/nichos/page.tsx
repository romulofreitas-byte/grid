"use client";

import { AppShell } from "@/components/AppShell";
import { NichosCuradoriaPanel } from "@/components/admin/NichosCuradoriaPanel";
import { BACK } from "@/lib/back";

export default function AdminNichosPage() {
  return (
    <AppShell title="Nichos" back={BACK.painel}>
      <NichosCuradoriaPanel />
    </AppShell>
  );
}
