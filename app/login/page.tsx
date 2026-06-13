"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setError("That login didn't work. Check the email and password.");
      return;
    }
    router.push("/admin");
    router.refresh();
  };

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <form
        onSubmit={signIn}
        className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900/40 p-6"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-rapid-500">
            <Lock className="h-4.5 w-4.5 text-zinc-950" strokeWidth={2.4} />
          </div>
          <div>
            <div className="font-display text-base font-bold leading-none tracking-wide">
              ADMIN SIGN-IN
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-widest text-zinc-500">
              Superior Landcare LLC
            </div>
          </div>
        </div>
        <Field label="Email" value={email} onChange={setEmail} placeholder="business email" type="email" />
        <Field label="Password" value={password} onChange={setPassword} type="password" />
        {error && <div className="mb-3 text-xs text-red-400">{error}</div>}
        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className="font-display w-full rounded-md bg-rapid-500 py-2.5 font-semibold tracking-wide text-zinc-950 transition hover:bg-rapid-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
