import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminProfile,
  loginAdmin,
  type LoginResponse,
} from "../api/auth";
import {
  clearAuthSession,
  forceLogoutToLogin,
  getStoredAdmin,
  getToken,
  setAuthSession,
  setStoredAdmin,
  type AdminProfile,
} from "../lib/auth-storage";

type AuthContextValue = {
  admin: AdminProfile | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (input: {
    email: string;
    password: string;
    remember: boolean;
  }) => Promise<LoginResponse>;
  logout: () => void;
  isLoggingIn: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => getToken());
  const [admin, setAdmin] = useState<AdminProfile | null>(() => getStoredAdmin());

  const profileQuery = useQuery({
    queryKey: ["admin", "profile"],
    queryFn: async () => {
      const data = await fetchAdminProfile();
      setStoredAdmin(data.admin);
      setAdmin(data.admin);
      return data.admin;
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: ({
      email,
      password,
    }: {
      email: string;
      password: string;
      remember: boolean;
    }) => loginAdmin(email, password),
    onSuccess: (data, variables) => {
      setAuthSession(data.token, data.admin, variables.remember);
      setToken(data.token);
      setAdmin(data.admin);
      queryClient.setQueryData(["admin", "profile"], data.admin);
    },
  });

  const login = useCallback(
    async (input: { email: string; password: string; remember: boolean }) => {
      return loginMutation.mutateAsync(input);
    },
    [loginMutation],
  );

  const logout = useCallback(() => {
    clearAuthSession();
    setToken(null);
    setAdmin(null);
    queryClient.clear();
    forceLogoutToLogin();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      admin: admin ?? profileQuery.data ?? null,
      isAuthenticated: Boolean(token),
      isBootstrapping: Boolean(token) && profileQuery.isLoading,
      login,
      logout,
      isLoggingIn: loginMutation.isPending,
    }),
    [
      admin,
      profileQuery.data,
      profileQuery.isLoading,
      token,
      login,
      logout,
      loginMutation.isPending,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
