import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AiChatService, ChatReply } from './ai-chat.service';
import { AskChatDto } from './ask-chat.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('ai-chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  /**
   * Two limits on purpose:
   *  - `burst` stops someone holding down the send button;
   *  - `sustained` caps what a single IP can spend in an hour.
   * Every call costs money and may make two model requests when tools are used.
   */
  @Post('ask')
  @Throttle({ burst: { limit: 5, ttl: 10_000 }, sustained: { limit: 60, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.OK)
  async ask(@Body() dto: AskChatDto): Promise<ChatReply> {
    return this.aiChatService.ask(dto);
  }
}