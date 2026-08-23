"use client";

import { AuthProvider } from "@/lib/auth";
import { NotificationProvider } from "@/lib/notifications";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Toaster position="top-right" />
        {children}
      </NotificationProvider>
    </AuthProvider>
  );
}
