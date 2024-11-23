import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsString()
  firstname?: string;

  @IsNotEmpty()
  @IsString()
  lastname?: string;
}
