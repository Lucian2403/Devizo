import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOrganizationService } from "@/server/container";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();

  // If the user already has an organization, skip onboarding.
  const orgs = await getOrganizationService().getOrganizationsForUser(user.id);
  if (orgs.length > 0) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <OnboardingForm />
      </div>
    </div>
  );
}
