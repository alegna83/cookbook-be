import { Controller, Post, Body, Query, Get } from '@nestjs/common';
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


  /**
   * Endpoint to suggest the best hostel near the provided coordinates.
   * Example: GET /suggestions/best-hostel?lat=40.123&lon=-8.456
   */
  @Get('best-hostel')
  async bestHostel(@Query('lat') lat: number, @Query('lon') lon: number) {
    return this.suggestionService.sugerirMelhorAlbergue(Number(lat), Number(lon));
  }
}
