import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class SubscriptionStatusDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email: string;
}
