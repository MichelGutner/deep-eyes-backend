import { IsArray, IsString, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { LogInputDto } from './logs.dto';

export class BatchLogDto {
  @IsString()
  apiKey: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LogInputDto)
  batch: LogInputDto[];
}

export interface BatchIngestResult {
  accepted: number;
  rejected: number;
  errors?: string[];
}
