import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOrganizationService } from "@/server/container";
import { signOut } from "../(auth)/actions";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { MainNav } from "./main-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Users without an organization are sent to onboarding first.
  const orgs = await getOrganizationService().getOrganizationsForUser(user.id);
  if (orgs.length === 0) redirect("/onboarding");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Logo />
            <MainNav />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {orgs[0]?.name}
            </span>
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
