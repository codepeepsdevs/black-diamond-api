import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class CreateSubscriptionDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email: string;
}
