import api from "../lib/api";
import type { AdminProfile } from "../lib/auth-storage";

export type LoginResponse = {
  success: boolean;
  token: string;
  admin: AdminProfile;
};

export type ProfileResponse = {
  success: boolean;
  admin: AdminProfile;
};

export type MessageResponse = {
  success: boolean;
  message: string;
};

export async function loginAdmin(email: string, password: string) {
  const { data } = await api.post<LoginResponse>("/admin/auth/login", {
    email,
    password,
  });
  return data;
}

export async function fetchAdminProfile() {
  const { data } = await api.get<ProfileResponse>("/admin/auth/profile");
  return data;
}

export async function forgotAdminPassword(email: string) {
  const { data } = await api.post<MessageResponse>(
    "/admin/auth/forgot-password",
    { email },
  );
  return data;
}

export async function resetAdminPassword(token: string, password: string) {
  const { data } = await api.post<MessageResponse>(
    "/admin/auth/reset-password",
    { token, password },
  );
  return data;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object"
  ) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (typeof data === "object" && data !== null) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message)) return message.join(", ");
      const errorMsg = (data as { error?: unknown }).error;
      if (typeof errorMsg === "string") return errorMsg;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
