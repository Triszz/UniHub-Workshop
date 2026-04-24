import type { User } from "../types";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user";
const SUPPORTED_ROLES = new Set<User["role"]>(["student", "organizer"]);

export const clearAuthSession = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("auth:session-cleared"));
};

export const persistAuthSession = (
  accessToken: string,
  refreshToken: string,
  user: User,
) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const readAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);

export const readRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const updateAccessToken = (accessToken: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
};

const parseUser = (): User | null => {
  const rawUser = localStorage.getItem(USER_KEY);
  if (!rawUser) return null;

  try {
    const parsed = JSON.parse(rawUser) as User;
    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.fullName !== "string" ||
      typeof parsed.role !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const loadAuthSession = (): {
  accessToken: string;
  refreshToken: string;
  user: User;
} | null => {
  const accessToken = readAccessToken();
  const refreshToken = readRefreshToken();
  const user = parseUser();

  if (!accessToken || !refreshToken || !user) {
    return null;
  }

  return { accessToken, refreshToken, user };
};

export const isWebSupportedRole = (
  role: User["role"],
): role is "student" | "organizer" => SUPPORTED_ROLES.has(role);

export const getHomePathByRole = (role: User["role"]) => {
  if (role === "student") return "/";
  if (role === "organizer") return "/admin";
  return "/login";
};
