import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { signInWithGoogle } from "@/app/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/chat");

  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/15 p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Personal Agent OS</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Private read-only assistant. Sign in with the authorized Google
          account to continue.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error === "AccessDenied"
              ? "This Google account is not authorized to access the app."
              : "Sign-in failed. Please try again."}
          </div>
        )}

        <form action={signInWithGoogle} className="mt-6">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Continue with Google
          </button>
        </form>

        <p className="mt-4 text-xs text-black/40 dark:text-white/40">
          Read-only access to Google Calendar and Gmail. No write
          permissions are requested.
        </p>
      </div>
    </main>
  );
}
