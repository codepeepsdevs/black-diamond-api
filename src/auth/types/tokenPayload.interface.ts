import { User } from '@prisma/client';

export interface TokenPayload {
  userId: User['id'];
}
