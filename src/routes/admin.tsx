import { createFileRoute, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { isLocalDemo } from "@/lib/local-demo";
import { AdminShell } from "@/components/AdminShell";

export const Route = createFileRoute("/admin")({ component: AdminLayout });
function AdminLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, loading } = useSession();
  if (!isLocalDemo() && !loading && !user) throw redirect({ to: "/auth", search: { redirect: pathname } });
  return <AdminShell><Outlet /></AdminShell>;
}
