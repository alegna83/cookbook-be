import { Controller, Post, Body, BadRequestException, HttpCode } from '@nestjs/common';
import { PlacesService } from './places.service';
import { HandlePlaceDto } from './dto/handle-place.dto';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Post('handle')
  @HttpCode(200)
  async handle(@Body() data: HandlePlaceDto): Promise<any> {
    switch (data.action) {
      case 'getAll':
        return this.placesService.findAll(data.page, data.limit);

      case 'getOne':
        if (!data.payload || !data.payload?.id) {
          throw new BadRequestException('ID do place é obrigatório.');
        }
        return this.placesService.findOne(Number(data.payload.id));
      case 'create':
        if (!data.payload) {
          throw new BadRequestException('Dados para criação em falta.');
        }
        return this.placesService.create(data.payload as any);
      case 'getByCamino':
        if (!data.payload?.byCamino) {
          throw new BadRequestException('Nome do caminho em falta.');
        }
        return this.placesService.findByCamino(data.payload.byCamino);
      case 'getByBounds':
        if (!data.payload?.bounds) {
          throw new BadRequestException('Coordenadas em falta.');
        }
        return this.placesService.getByBounds(data.payload.bounds);
      default:
          throw new BadRequestException('Ação desconhecida.');
    }
  }
}
