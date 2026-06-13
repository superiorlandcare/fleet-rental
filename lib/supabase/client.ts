import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client — anon/publishable key only. Used for admin auth and
 * authenticated catalog writes; never sees the service role key.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
