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
    const normalizedAction = (data.action ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[-_\s]/g, '');

    const timerLabel = `HANDLE_${normalizedAction.toUpperCase() || 'UNKNOWN'}`;

    if (this.shouldLogTiming) {
      console.time(timerLabel);
    }

    try {
      switch (normalizedAction) {
        case 'getall':
          return this.accommodationsService.findAll(data.page, data.limit);

        case 'getone':
          if (!data.payload || !data.payload?.id) {
            throw new BadRequestException('ID do accommodation é obrigatório.');
          }
          const accountId = data.payload?.accountId ? Number(data.payload.accountId) : undefined;
          return this.accommodationsService.findOne(Number(data.payload.id), accountId);

        case 'create':
          if (!data.payload) {
            throw new BadRequestException('Dados para criação em falta.');
          }
          return this.accommodationsService.create(data.payload as CreateAccommodationDto);

        case 'getbycamino':
          if (!data.payload?.byCamino) {
            throw new BadRequestException('Nome do caminho em falta.');
          }
          return this.accommodationsService.findByCamino(data.payload.byCamino);

        case 'getbyowner':
          if (!data.payload?.ownerId) {
            throw new BadRequestException('ownerId é obrigatório.');
          }
          return this.accommodationsService.findByAccount(Number(data.payload.ownerId));

        case 'getbybounds':
          if (!data.payload?.bounds) {
            throw new BadRequestException('Coordenadas em falta.');
          }
          return this.accommodationsService.getByBounds(data.payload.bounds);

        case 'getbyplaceid':
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

        case 'addphotos':
          if (!data.payload?.placeId) {
            throw new BadRequestException('placeId é obrigatório.');
          }
          if (!data.payload?.accountId) {
            throw new BadRequestException('accountId é obrigatório.');
          }
          if (!Array.isArray(data.payload?.photoUrls)) {
            throw new BadRequestException('photoUrls é obrigatório.');
          }
          return this.accommodationsService.addGalleryPhotos(
            Number(data.payload.placeId),
            Number(data.payload.accountId),
            data.payload.photoUrls,
          );

        case 'requestremoval':
        case 'requestdelete':
        case 'deleterequest':
        case 'removerequest':
          if (!data.payload?.placeId) {
            throw new BadRequestException('placeId é obrigatório.');
          }
          if (!data.payload?.accountId) {
            throw new BadRequestException('accountId é obrigatório.');
          }
          return this.accommodationsService.requestRemoval(
            data.payload as CreateRemovalRequestDto,
          );

        case 'getmyremovalrequests':
        case 'getremovalrequestsbyaccount':
          if (!data.payload?.accountId) {
            throw new BadRequestException('accountId é obrigatório.');
          }
          return this.accommodationsService.getRemovalRequestsByAccount(
            Number(data.payload.accountId),
          );

        case 'approvephotos':
          if (!data.payload?.photoId) {
            throw new BadRequestException('photoId é obrigatório.');
          }
          return this.accommodationsService.approvePhoto(Number(data.payload.photoId));

        case 'rejectphotos':
          if (!data.payload?.photoId) {
            throw new BadRequestException('photoId é obrigatório.');
          }
          return this.accommodationsService.rejectPhoto(
            Number(data.payload.photoId),
            data.payload?.rejectionReason || undefined,
          );

        case 'getpendingphotos':
          if (!data.payload?.placeId) {
            throw new BadRequestException('placeId é obrigatório.');
          }
          return this.accommodationsService.getPendingPhotosForAccommodation(
            Number(data.payload.placeId),
          );

        case 'getpendingphotosadmin':
          return this.accommodationsService.getPendingPhotosAdmin();

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
