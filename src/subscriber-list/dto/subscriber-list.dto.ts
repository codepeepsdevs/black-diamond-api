import { IsArray, IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateSubscriberListDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateSubscribersListDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  subscriberIds: string[];
}

export class AddOneSubscriberToListDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class AddSubscriberByDetailsDto {
  @IsString()
  @IsNotEmpty()
  details: string;
}

export class ChangeSubscriberListNameDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
