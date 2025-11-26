import {
  Controller,
  Post,
  Body,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { HandleFavoriteDto } from './dto/handle-favorite.dto';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly svc: FavoritesService) {}

  // Endpoint único "handle" para todas as operações do frontend (Flutter)
  @Post('handle')
  @HttpCode(200)
  async handle(@Body() data: HandleFavoriteDto): Promise<any> {
    switch (data.action) {
      case 'list':
        if (!data.payload?.accountId)
          throw new BadRequestException('accountId é obrigatório.');
        return this.svc.listByAccount(Number(data.payload.accountId));

      case 'add':
        if (!data.payload?.placeId || !data.payload?.accountId) {
          throw new BadRequestException(
            'placeId e accountId são obrigatórios.',
          );
        }
        return this.svc.add({
          placeId: Number(data.payload.placeId),
          accountId: Number(data.payload.accountId),
        });

      case 'remove':
        if (!data.payload?.id)
          throw new BadRequestException('id do favorite é obrigatório.');
        await this.svc.remove(
          Number(data.payload.id),
          data.payload.accountId ? Number(data.payload.accountId) : undefined,
        );
        return { ok: true };

      case 'exists':
        if (!data.payload?.placeId || !data.payload?.accountId) {
          throw new BadRequestException(
            'placeId e accountId são obrigatórios.',
          );
        }
        return {
          exists: await this.svc.exists(
            Number(data.payload.accountId),
            Number(data.payload.placeId),
          ),
        };

      case 'toggle':
        if (!data.payload?.placeId || !data.payload?.accountId) {
          throw new BadRequestException(
            'placeId e accountId são obrigatórios.',
          );
        }
        return this.svc.toggle(
          Number(data.payload.accountId),
          Number(data.payload.placeId),
        );

      default:
        throw new BadRequestException('Ação desconhecida.');
    }
  }
}
