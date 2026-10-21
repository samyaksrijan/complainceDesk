"use client";

import { useSession } from "next-auth/react";
import { createContext, ReactNode, useContext } from "react";

interface AuthContextType {
  user: import("next-auth").Session["user"] | undefined;
  isLoading: boolean;
  isAdmin: boolean;
  isAuditor: boolean;
  isViewer: boolean;
  canEdit: boolean;
  canUpload: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  const user = session?.user;
  const isLoading = status === "loading";

  const isAdmin = user?.role === "ADMIN";
  const isAuditor = user?.role === "AUDITOR";
  const isViewer = user?.role === "VIEWER";

  const canEdit = isAdmin || isAuditor;
  const canUpload = isAdmin || isAuditor;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin, isAuditor, isViewer, canEdit, canUpload }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
