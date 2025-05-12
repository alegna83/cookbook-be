import { Controller, Post, Body } from '@nestjs/common';
import { SuggestionService } from './suggestion.service';

@Controller('sugestoes')
export class SuggestionController {
  constructor(private readonly suggestionService: SuggestionService) {}

  @Post('sugerir')
  async sugerir(@Body() body: { lat: number; lon: number; interesse: string }) {
    const { lat, lon, interesse } = body;

    const prompt = `Quais são os 3 melhores locais turísticos em Viseu, próximos de latitude ${lat} e longitude ${lon}, que sejam ${interesse}?Para cada local, indica apenas o nome e a localização (de preferência com coordenadas). Não incluas descrições nem explicações.`;

    return this.suggestionService.sugerirLugares(prompt);
  }
}
