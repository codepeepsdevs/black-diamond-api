import { IsString, IsEmail, Length } from 'class-validator';

export class CreateContactDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsString()
  @Length(1, 100)
  subject: string;

  @IsEmail()
  email: string;

  @IsString()
  @Length(1, 2000) // Assuming a message could be long
  message: string;
}
