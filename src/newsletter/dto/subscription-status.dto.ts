import { IsEmail } from 'class-validator';

export class SubscriptionStatusDto {
  @IsEmail()
  email: string;
}
