import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminApp } from "@/components/admin/AdminApp";
import { SignOutButton } from "./SignOutButton";

// Second layer behind middleware — never render admin without a session.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-5xl px-5 py-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-bold tracking-wide">
            ADMIN <span className="text-rapid-500">·</span> SUPERIOR LANDCARE
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-zinc-500">
            Signed in as {user.email}
          </div>
        </div>
        <SignOutButton />
      </div>
      <AdminApp />
    </main>
  );
}
