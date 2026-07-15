import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AskChatDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1200)
  message: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
