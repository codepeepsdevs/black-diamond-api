import { IsEmail } from 'class-validator';

export class CreateSubscriptionDto {
  @IsEmail()
  email: string;
}
