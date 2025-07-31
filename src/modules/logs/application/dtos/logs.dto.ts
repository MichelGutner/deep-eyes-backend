import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsObject,
  IsISO8601,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ParsedDataDto {
  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsNumber()
  statusCode?: number;

  @IsOptional()
  @IsNumber()
  responseTime?: number;

  @IsOptional()
  @IsString()
  errorType?: string;

  @IsOptional()
  @IsString()
  stackTrace?: string;
}

export class LogDocumentDto {
  @IsOptional()
  @IsISO8601()
  timestamp: string;

  @IsIn(['debug', 'info', 'warn', 'error', 'fatal'])
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';

  @IsString()
  message: string;

  @IsString()
  service: string;

  @IsOptional()
  @IsString()
  traceId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsObject()
  metadata: Record<string, unknown>;

  @ValidateNested()
  @Type(() => ParsedDataDto)
  parsed: ParsedDataDto;
}

export class LogsDto {
  @IsString()
  @IsOptional()
  index?: string;

  @IsNumber()
  @IsOptional()
  size?: number;

  @ValidateNested({ each: true })
  @Type(() => LogDocumentDto)
  logs: LogDocumentDto[];
}

class GeoDto {
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lon?: number;
}

class AuthDto {
  @IsOptional()
  has2fa?: boolean;

  @IsOptional()
  @IsString()
  firstLogin?: string;

  @IsOptional()
  @IsString()
  lastLogin?: string;
}

class UserDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  device?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AuthDto)
  auth?: AuthDto;
}

export class LogApplicationInputDto {
  @IsString()
  message: string;

  @IsIn(['info', 'debug', 'warn'])
  level: 'info' | 'debug' | 'warn';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  statusCode?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserDto)
  user?: UserDto;
}
