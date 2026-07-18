import { useAuth } from "@/lib/AuthContext";

export function useCurrentUser() {
  const { user, isLoadingAuth } = useAuth();
  return { user, loading: isLoadingAuth, role: user?.role || "viewer" };
}