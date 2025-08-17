import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsObject,
  ValidateNested,
  IsArray,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LogLevel } from '@/types/logs';
class UserDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  device?: string;
}

class ErrorDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  stack?: string;

  @IsOptional()
  @IsString()
  cause?: string;

  @IsOptional()
  @IsString()
  fingerprint?: string;

  @IsOptional()
  @IsString()
  class?: string;

  @IsOptional()
  @IsNumber()
  statusCode?: number;

  @IsOptional()
  @IsString()
  statusText?: string;
}

export class LogInputDto {
  @IsString()
  message: string;

  @IsEnum(LogLevel)
  level: LogLevel;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  statusCode?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserDto)
  user?: UserDto;

  // @IsOptional()
  @IsObject()
  @ValidateIf((obj) => obj.level === LogLevel.ERROR)
  error?: ErrorDto;

  @IsArray()
  @IsOptional()
  tags?: string[];
}
