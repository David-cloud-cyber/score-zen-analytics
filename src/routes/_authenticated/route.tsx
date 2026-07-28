import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      // Lire la session depuis localStorage (rapide, sans réseau).
      // autoRefreshToken: true garantit que le token est renouvelé si expiré.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) {
        throw redirect({ to: "/auth", search: { redirect: location.pathname } });
      }
      return { user: sessionData.session.user };
    } catch (err) {
      if (err && typeof err === "object" && ("isRedirect" in err || "status" in err || "statusCode" in err)) {
        throw err;
      }
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
  },
  component: () => <Outlet />,
});
