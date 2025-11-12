// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

const defaultRoles: UserRole[] = ['user', 'admin', 'viewer'];
export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) =>
  SetMetadata(
    ROLES_KEY,
    roles.length > 0 ? roles.map((role) => role.toLowerCase()) : defaultRoles,
  );
