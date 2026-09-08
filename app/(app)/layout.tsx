import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOrganizationService } from "@/server/container";
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
  const user = await requireUser();

  // Users without an organization are sent to onboarding first.
  const orgs = await getOrganizationService().getOrganizationsForUser(user.id);
  if (orgs.length === 0) redirect("/onboarding");

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email ||
    "Utilizator";
  const orgName = orgs[0]?.name ?? "";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-card/95 px-6 backdrop-blur">
          <MainNav />
          <div className="flex items-center gap-3">
            <div className="hidden items-center md:flex">
              <input
                type="search"
                placeholder="Caută în proiecte..."
                className="h-9 w-56 rounded-md border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <button
              type="button"
              aria-label="Notificări"
              aria-disabled="true"
              disabled
              className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground opacity-60"
            >
              🔔
            </button>
            <div className="flex items-center gap-2.5">
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
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
