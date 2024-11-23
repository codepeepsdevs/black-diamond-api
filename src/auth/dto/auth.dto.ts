import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email: string;

  @IsNotEmpty()
  firstname: string;

  @IsNotEmpty()
  lastname: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class CompleteSignupDto {
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token: string;

  @IsNotEmpty()
  firstname: string;

  @IsNotEmpty()
  lastname: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class LoginDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email: string;

  @IsNotEmpty()
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email: string;
}

export class ResetPasswordDto {
  @IsNotEmpty()
  resetToken: string;

  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;

  @IsNotEmpty()
  @MinLength(6)
  confirmPassword: string;
}

export class VerifyEmailBody {
  @IsString()
  @IsNotEmpty()
  email: string;
}
