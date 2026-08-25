export const ORGANIZATION_ROLES = ["owner", "manager"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type UserId = string;
export type OrganizationId = string;
