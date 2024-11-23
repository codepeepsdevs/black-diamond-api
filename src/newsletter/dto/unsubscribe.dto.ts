import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class UnsubscribeDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email: string;
}
