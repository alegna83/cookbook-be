import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { PlacesService } from './places.service';
import { HandlePlaceDto } from './dto/handle-place.dto';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Post('handle')
  async handle(@Body() data: HandlePlaceDto): Promise<any> {
    switch (data.action) {
      case 'getAll':
        return this.placesService.findAll(data.page, data.limit);

      case 'getOne':
        if (!data.payload?.id) {
          throw new BadRequestException('ID do place é obrigatório.');
        }
        return this.placesService.findOne(data.payload.id);

      case 'create':
        if (!data.payload) {
          throw new BadRequestException('Dados para criação em falta.');
        }
        return this.placesService.create(data.payload);

      default:
        throw new BadRequestException('Ação desconhecida.');
    }
  }
}
