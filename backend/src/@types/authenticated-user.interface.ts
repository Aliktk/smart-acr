import type { UserRole } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  activeRole: UserRole;
}
