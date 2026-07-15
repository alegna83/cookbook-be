import { Body, Controller, Post } from '@nestjs/common';
import { AiChatService, ChatReply } from './ai-chat.service';
import { AskChatDto } from './ask-chat.dto';

@Controller('ai-chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('ask')
  async ask(@Body() dto: AskChatDto): Promise<ChatReply> {
    return this.aiChatService.ask(dto);
  }
}
