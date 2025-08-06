import { IsString } from 'class-validator';

export class TokenInputDto {
  @IsString()
  token: string;
}
