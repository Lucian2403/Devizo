import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getOrganizationService } from "@/server/container";
import { signOut } from "../(auth)/actions";
import { Button } from "@/components/ui/button";

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
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold">QuoteAI</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link
              href="/customers"
              className="text-muted-foreground hover:text-foreground"
            >
              Customers
            </Link>
            <Link
              href="/settings"
              className="text-muted-foreground hover:text-foreground"
            >
              Settings
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{orgs[0]?.name}</span>
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
