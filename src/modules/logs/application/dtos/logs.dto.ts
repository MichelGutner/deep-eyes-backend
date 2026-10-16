import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  ValidateNested,
  IsArray,
  IsEnum,
  ValidateIf,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LogLevel } from '@/types/logs';

class UserDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  device?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

class ErrorCauseDto {
  @IsString()
  name: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  stack?: string;
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
  @ValidateNested()
  @Type(() => ErrorCauseDto)
  cause?: ErrorCauseDto;

  @IsOptional()
  @IsString()
  componentStack?: string;
}

export class StackFrameDto {
  @IsString()
  filename: string;

  @IsString()
  function: string;

  @IsOptional()
  @IsNumber()
  lineno?: number;

  @IsOptional()
  @IsNumber()
  colno?: number;

  @IsBoolean()
  in_app: boolean;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  context_line?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pre_context?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  post_context?: string[];
}

export class BreadcrumbDto {
  @IsString()
  timestamp: string;

  @IsIn(['navigation', 'http', 'ui', 'console', 'error', 'query', 'lifecycle'])
  type: string;

  @IsString()
  category: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsIn(['debug', 'info', 'warn', 'error'])
  level?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, string | number | boolean>;
}

export class DeviceContextDto {
  @IsOptional()
  @IsString()
  os?: string;

  @IsOptional()
  @IsString()
  osVersion?: string;

  @IsOptional()
  @IsString()
  browser?: string;

  @IsOptional()
  @IsString()
  browserVersion?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  screenResolution?: string;

  @IsOptional()
  @IsNumber()
  screenDensity?: number;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  online?: boolean;

  @IsOptional()
  @IsNumber()
  memoryMb?: number;

  @IsOptional()
  @IsBoolean()
  simulator?: boolean;

  @IsOptional()
  @IsIn(['portrait', 'landscape'])
  orientation?: string;

  @IsOptional()
  @IsNumber()
  battery?: number;

  @IsOptional()
  @IsString()
  arch?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumber()
  freeMemoryMb?: number;

  @IsOptional()
  @IsNumber()
  totalStorageMb?: number;

  @IsOptional()
  @IsNumber()
  freeStorageMb?: number;

  @IsOptional()
  @IsIn(['charging', 'full', 'unplugged', 'unknown'])
  batteryState?: string;

  @IsOptional()
  @IsIn(['wifi', 'cellular', 'ethernet', 'vpn', 'none', 'unknown'])
  networkType?: string;

  @IsOptional()
  @IsString()
  carrier?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsBoolean()
  rooted?: boolean;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class HttpContextDto {
  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsNumber()
  statusCode?: number;

  @IsOptional()
  @IsNumber()
  responseTime?: number;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsString()
  queryString?: string;

  @IsOptional()
  @IsNumber()
  bodySize?: number;
}

export class SdkDto {
  @IsString()
  name: string;

  @IsString()
  version: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  integrations?: string[];
}

export class LogInputDto {
  @IsString()
  message: string;

  @IsEnum(LogLevel)
  level: LogLevel;

  @IsOptional()
  @IsIn(['web', 'ios', 'android', 'backend', 'other'])
  platform?: string;

  @IsOptional()
  @IsString()
  app?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsString()
  release?: string;

  @IsOptional()
  @IsString()
  fingerprint?: string;

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

  @IsObject()
  @ValidateIf((obj) => obj.level === LogLevel.ERROR || obj.level === LogLevel.FATAL)
  error?: ErrorDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StackFrameDto)
  stackFrames?: StackFrameDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BreadcrumbDto)
  breadcrumbs?: BreadcrumbDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceContextDto)
  device?: DeviceContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HttpContextDto)
  http?: HttpContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SdkDto)
  sdk?: SdkDto;

  @IsArray()
  @IsOptional()
  tags?: string[];
}
