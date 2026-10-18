import { useState } from "react";

type User = { email: string; role?: string } | null;

export function useAuth() {
  const [user] = useState<User>(null);
  const logout = async () => {};
  return { user, logout };
}