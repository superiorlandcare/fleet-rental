"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };
  return (
    <button
      type="button"
      onClick={signOut}
      className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
    >
      <LogOut className="h-3.5 w-3.5" /> Sign out
    </button>
  );
}
