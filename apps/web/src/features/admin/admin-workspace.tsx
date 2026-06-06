"use client";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { AdminPage } from "@/features/admin/admin-page";
import type { AdminSection } from "@/features/admin/model/admin-nav";

export function AdminWorkspace({ activeSection }: { activeSection: AdminSection }) {
  return (
    <AdminLayout activeSection={activeSection}>
      <AdminPage activeSection={activeSection} />
    </AdminLayout>
  );
}
