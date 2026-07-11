import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactRequestDto } from './contact-request.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post('send')
  async send(@Body() body: ContactRequestDto): Promise<{ message: string }> {
    if (!body) {
      throw new BadRequestException('Request body is required.');
    }

    return this.contactService.sendContactMessage(body);
  }
}
