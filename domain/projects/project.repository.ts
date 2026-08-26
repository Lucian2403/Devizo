import type {
  CustomerId,
  OrganizationId,
  ProjectId,
  ProjectStatus,
} from "@/domain/shared/types";

export interface Project {
  id: ProjectId;
  organizationId: OrganizationId;
  customerId: CustomerId | null;
  customerName: string | null;
  name: string;
  address: string | null;
  description: string | null;
  notes: string | null;
  status: ProjectStatus;
  archivedAt: Date | null;
}

// Fields a user can set when creating or editing a project.
export interface ProjectData {
  customerId?: CustomerId;
  name: string;
  address?: string;
  description?: string;
  notes?: string;
  status: ProjectStatus;
}

/**
 * Port owned by the domain. Infrastructure implements it with Drizzle.
 */
export interface ProjectRepository {
  listActive(organizationId: OrganizationId): Promise<Project[]>;
  listArchived(organizationId: OrganizationId): Promise<Project[]>;
  getById(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<Project | null>;
  create(organizationId: OrganizationId, data: ProjectData): Promise<Project>;
  update(
    organizationId: OrganizationId,
    projectId: ProjectId,
    data: ProjectData,
  ): Promise<Project>;
  setArchived(
    organizationId: OrganizationId,
    projectId: ProjectId,
    archived: boolean,
  ): Promise<void>;
}
