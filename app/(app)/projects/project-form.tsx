"use client";

import { useActionState } from "react";
import type { Project } from "@/domain/projects/project.repository";
import type { ProjectFormState } from "./actions";
import { PROJECT_STATUSES } from "@/domain/shared/types";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

const STATUS_LABELS: Record<(typeof PROJECT_STATUSES)[number], string> = {
  planned: "Planificat",
  active: "Activ",
  completed: "Finalizat",
};

// A minimal customer option for the dropdown.
export interface CustomerOption {
  id: string;
  name: string;
}

export function ProjectForm({
  action,
  project,
  customers,
  submitLabel,
}: {
  action: (state: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;
  project?: Project;
  customers: CustomerOption[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<ProjectFormState, FormData>(
    action,
    null,
  );

  return (
    <Card>
      <form action={formAction}>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Numele proiectului</Label>
            <Input
              id="name"
              name="name"
              defaultValue={project?.name ?? ""}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerId">Client</Label>
              <select
                id="customerId"
                name="customerId"
                defaultValue={project?.customerId ?? ""}
                className={selectClasses}
              >
                <option value="">Fără client</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={project?.status ?? "planned"}
                className={selectClasses}
              >
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adresă</Label>
            <Input
              id="address"
              name="address"
              defaultValue={project?.address ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descriere</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={project?.description ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={project?.notes ?? ""}
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter>
          <SubmitButton pendingLabel="Se salvează...">{submitLabel}</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
