"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    // Le backend repond 403 FORCE_PASSWORD_CHANGE sur tous les endpoints sauf
    // /users/me et /auth/change-password : toute autre page serait vide.
    if (user.forcePasswordChange && pathname !== "/profile") {
      router.replace("/profile");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-bg dark:bg-neutral-950">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-dvh bg-bg dark:bg-neutral-950 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Topbar />

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-border dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <button
          onClick={() => setSidebarOpen(true)}
          className="size-9 rounded-lg flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <svg className="size-5 text-neutral-700 dark:text-neutral-300" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-brand dark:text-white">PIM Moov Africa</span>
      </div>

      <main className="lg:ml-65 h-dvh overflow-y-auto hide-scrollbar p-4 pt-16 lg:p-6 lg:pt-20">
        {children}
      </main>
    </div>
  );
}
