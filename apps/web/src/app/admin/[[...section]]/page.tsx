import { AuthGuard } from "@/features/auth";
import { AdminGuard, AdminWorkspace, adminSectionFromPath } from "@/features/admin";

type Props = {
  params: Promise<{ section?: string[] }>;
};

export default async function AdminPortalPage({ params }: Props) {
  const { section } = await params;
  const activeSection = adminSectionFromPath(section);

  return (
    <AuthGuard>
      <AdminGuard>
        <AdminWorkspace activeSection={activeSection} />
      </AdminGuard>
    </AuthGuard>
  );
}
