import type { OrganizationId, ProjectId } from "@/domain/shared/types";
import type {
  Project,
  ProjectData,
  ProjectQuoteSnapshot,
  ProjectRepository,
} from "./project.repository";

export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found.");
    this.name = "ProjectNotFoundError";
  }
}

/**
 * Business logic for projects. Archiving is separate from work status.
 * Projects are archived, never hard-deleted.
 */
export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}

  listProjects(organizationId: OrganizationId): Promise<Project[]> {
    return this.repository.listActive(organizationId);
  }

  listArchivedProjects(organizationId: OrganizationId): Promise<Project[]> {
    return this.repository.listArchived(organizationId);
  }

  async getProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<Project> {
    const project = await this.repository.getById(organizationId, projectId);
    if (!project) throw new ProjectNotFoundError();
    return project;
  }

  async getQuoteSnapshot(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<ProjectQuoteSnapshot> {
    const snapshot = await this.repository.getQuoteSnapshot(
      organizationId,
      projectId,
    );
    if (!snapshot) throw new ProjectNotFoundError();
    return snapshot;
  }

  createProject(
    organizationId: OrganizationId,
    data: ProjectData,
  ): Promise<Project> {
    return this.repository.create(organizationId, data);
  }

  updateProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
    data: ProjectData,
  ): Promise<Project> {
    return this.repository.update(organizationId, projectId, data);
  }

  archiveProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<void> {
    return this.repository.setArchived(organizationId, projectId, true);
  }

  restoreProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<void> {
    return this.repository.setArchived(organizationId, projectId, false);
  }
}
