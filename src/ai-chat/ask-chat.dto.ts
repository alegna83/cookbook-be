import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class AskChatDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1200)
  message!: string;

  /**
   * Identifies the conversation so the backend can keep the history.
   * The frontend must generate it once (Uuid v4) when the chat is opened
   * and send the SAME value on every request until the chat is closed.
   */
  @IsOptional()
  @IsUUID('4')
  conversationId?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  /**
   * Preferably sent by Flutter: Localizations.localeOf(context).languageCode
   * This is the most reliable source of truth for the answer language.
   */
  @IsOptional()
  @IsString()
  @Matches(/^(pt|en|fr|es|de|it)$/, {
    message: 'language must be a valid ISO 639-1 code (pt, en, fr, es, de, it)',
  })
  language?: string;

  /**
   * Optional chat mode. Default is Camino de Santiago scope, but the UI can
   * expose a general mode for broader travel questions.
   */
  @IsOptional()
  @IsString()
  @Matches(/^(camino|general)$/, {
    message: 'scope must be either camino or general',
  })
  scope?: 'camino' | 'general';
}