import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getCurrentOrg } from "@/lib/auth/current-org";
import { signOut } from "../(auth)/actions";
import { Button } from "@/components/ui/button";
import { MainNav } from "./main-nav";
import { Sidebar } from "./sidebar";

// Builds the two-letter avatar initials from a name or email.
function initials(source: string) {
  const parts = source.trim().split(/[\s@.]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]!.toUpperCase());
  return letters.join("") || "U";
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, currentOrg] = await Promise.all([
    requireUser(),
    getCurrentOrg(),
  ]);

  // Users without an organization are sent to onboarding first.
  if (!currentOrg.org) redirect("/onboarding");

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email ||
    "Utilizator";
  const orgName = currentOrg.org.name;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 min-w-0 items-center justify-between gap-3 border-b border-border bg-card/95 px-3 backdrop-blur sm:px-6">
          <div className="min-w-0 flex-1">
            <MainNav />
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-heading text-[13px] font-semibold text-white">
              {initials(displayName)}
            </span>
            <div className="hidden leading-tight sm:block">
              <p className="text-[13px] font-medium text-heading">
                {displayName}
              </p>
              <p className="text-[12px] text-muted-foreground">{orgName}</p>
            </div>
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">
                Ieși
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
