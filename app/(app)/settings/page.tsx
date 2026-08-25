import { requireCurrentOrg } from "@/lib/auth/current-org";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const { org } = await requireCurrentOrg();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Company settings</h1>
        <p className="text-muted-foreground">
          These details appear on your estimates and documents.
        </p>
      </div>
      <SettingsForm org={org} />
    </div>
  );
}
