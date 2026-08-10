import { IsObject, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class AskChatDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1200)
  message: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Matches(/^(pt|en|fr|es|de|it)$/, {
    message: 'language must be a valid ISO 639-1 code (pt, en, fr, es, de, it)',
  })
  language?: string;
}
