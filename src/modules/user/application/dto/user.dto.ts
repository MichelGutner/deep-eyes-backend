import { UserRole } from '@prisma/client';
import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsString()
  organizationId: string;

  @IsOptional()
  @IsEnum(UserRole)
  role: UserRole;
}
