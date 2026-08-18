"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";
import AppBar from "@/components/AppBar";
import { ThemeColorProvider } from "@/lib/theme";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-bg dark:bg-neutral-950">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <ThemeColorProvider>
      <div className="h-dvh bg-bg dark:bg-neutral-950 overflow-hidden">
        <Sidebar />
        <CommandPalette />
        <div className="ml-65 h-dvh flex flex-col overflow-hidden">
          <AppBar />
          <main className="flex-1 overflow-y-auto hide-scrollbar p-6">
            {children}
          </main>
        </div>
      </div>
    </ThemeColorProvider>
  );
}
