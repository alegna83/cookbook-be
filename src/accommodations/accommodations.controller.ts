import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { AccommodationsService } from './accommodations.service';
import { HandleAccommodationDto } from './dto/handle-accommodation.dto';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto';
import { CreateRemovalRequestDto } from './dto/create-removal-request.dto';

@Controller('accommodations')
export class AccommodationsController {
  private readonly shouldLogTiming = process.env.LOG_REQUEST_TIMINGS === 'true';

  constructor(private readonly accommodationsService: AccommodationsService) {}

  @Post('handle')
  @HttpCode(200)
  async handle(@Body() data: HandleAccommodationDto): Promise<any> {
    const timerLabel = `HANDLE_${data.action?.toUpperCase() || 'UNKNOWN'}`;

    if (this.shouldLogTiming) {
      console.time(timerLabel);
    }

    try {
      switch (data.action) {
        case 'getAll':
          return this.accommodationsService.findAll(data.page, data.limit);

        case 'getOne':
          if (!data.payload || !data.payload?.id) {
            throw new BadRequestException('ID do accommodation é obrigatório.');
          }
          return this.accommodationsService.findOne(Number(data.payload.id));

        case 'create':
          if (!data.payload) {
            throw new BadRequestException('Dados para criação em falta.');
          }
          return this.accommodationsService.create(data.payload as CreateAccommodationDto);

        case 'getByCamino':
          if (!data.payload?.byCamino) {
            throw new BadRequestException('Nome do caminho em falta.');
          }
          return this.accommodationsService.findByCamino(data.payload.byCamino);

        case 'getByOwner':
          if (!data.payload?.ownerId) {
            throw new BadRequestException('ownerId é obrigatório.');
          }
          return this.accommodationsService.findByAccount(Number(data.payload.ownerId));

        case 'getByBounds':
          if (!data.payload?.bounds) {
            throw new BadRequestException('Coordenadas em falta.');
          }
          return this.accommodationsService.getByBounds(data.payload.bounds);

        case 'getByPlaceId':
          if (!data.payload?.placeId) {
            throw new BadRequestException('placeId é obrigatório.');
          }
          return this.accommodationsService.findAccommodationByPlaceId(
            Number(data.payload.placeId),
          );

        case 'edit':
          if (!data.payload?.id) {
            throw new BadRequestException('ID da acomodação é obrigatório.');
          }
          if (!data.payload?.accountId) {
            throw new BadRequestException('accountId é obrigatório.');
          }
          return this.accommodationsService.update(
            Number(data.payload.id),
            Number(data.payload.accountId),
            data.payload.data as UpdateAccommodationDto,
          );

        case 'requestRemoval':
          if (!data.payload?.placeId) {
            throw new BadRequestException('placeId é obrigatório.');
          }
          if (!data.payload?.accountId) {
            throw new BadRequestException('accountId é obrigatório.');
          }
          return this.accommodationsService.requestRemoval(
            data.payload as CreateRemovalRequestDto,
          );

        default:
          throw new BadRequestException('Ação desconhecida.');
      }
    } finally {
      if (this.shouldLogTiming) {
        console.timeEnd(timerLabel);
      }
    }
  }
}
