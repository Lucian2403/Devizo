import { and, eq, isNull, isNotNull, desc } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { projects, customers } from "@/infrastructure/db/schema";
import type {
  Project,
  ProjectData,
  ProjectRepository,
} from "@/domain/projects/project.repository";
import type {
  OrganizationId,
  ProjectId,
  ProjectStatus,
} from "@/domain/shared/types";

// Shape returned by the list/detail queries (project row + joined customer name).
type Row = {
  project: typeof projects.$inferSelect;
  customerName: string | null;
};

function toDomain(row: Row): Project {
  const p = row.project;
  return {
    id: p.id,
    organizationId: p.organizationId,
    customerId: p.customerId,
    customerName: row.customerName,
    name: p.name,
    address: p.address,
    description: p.description,
    notes: p.notes,
    status: p.status as ProjectStatus,
    archivedAt: p.archivedAt,
  };
}

function toColumns(data: ProjectData) {
  return {
    customerId: data.customerId ?? null,
    name: data.name,
    address: data.address ?? null,
    description: data.description ?? null,
    notes: data.notes ?? null,
    status: data.status,
  };
}

export class DrizzleProjectRepository implements ProjectRepository {
  private baseSelect() {
    return db
      .select({ project: projects, customerName: customers.name })
      .from(projects)
      .leftJoin(customers, eq(customers.id, projects.customerId));
  }

  async listActive(organizationId: OrganizationId): Promise<Project[]> {
    const rows = await this.baseSelect()
      .where(
        and(
          eq(projects.organizationId, organizationId),
          isNull(projects.archivedAt),
        ),
      )
      .orderBy(desc(projects.createdAt));
    return rows.map(toDomain);
  }

  async listArchived(organizationId: OrganizationId): Promise<Project[]> {
    const rows = await this.baseSelect()
      .where(
        and(
          eq(projects.organizationId, organizationId),
          isNotNull(projects.archivedAt),
        ),
      )
      .orderBy(desc(projects.archivedAt));
    return rows.map(toDomain);
  }

  async getById(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<Project | null> {
    const [row] = await this.baseSelect()
      .where(
        and(
          eq(projects.organizationId, organizationId),
          eq(projects.id, projectId),
        ),
      )
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async create(
    organizationId: OrganizationId,
    data: ProjectData,
  ): Promise<Project> {
    const [row] = await db
      .insert(projects)
      .values({ organizationId, ...toColumns(data) })
      .returning();
    return this.getById(organizationId, row!.id) as Promise<Project>;
  }

  async update(
    organizationId: OrganizationId,
    projectId: ProjectId,
    data: ProjectData,
  ): Promise<Project> {
    await db
      .update(projects)
      .set({ ...toColumns(data), updatedAt: new Date() })
      .where(
        and(
          eq(projects.organizationId, organizationId),
          eq(projects.id, projectId),
        ),
      );
    return this.getById(organizationId, projectId) as Promise<Project>;
  }

  async setArchived(
    organizationId: OrganizationId,
    projectId: ProjectId,
    archived: boolean,
  ): Promise<void> {
    await db
      .update(projects)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(
        and(
          eq(projects.organizationId, organizationId),
          eq(projects.id, projectId),
        ),
      );
  }
}
