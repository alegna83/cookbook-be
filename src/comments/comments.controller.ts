import {
  Controller,
  Post,
  Body,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { HandleCommentDto } from './dto/handle-comment.dto';

@Controller('comments')
export class CommentsController {
  constructor(private readonly svc: CommentsService) {}

  @Post('handle')
  @HttpCode(200)
  async handle(@Body() data: HandleCommentDto): Promise<any> {
    switch (data.action) {
      case 'list':
        if (!data.payload?.placeId) {
          throw new BadRequestException('placeId é obrigatório.');
        }
        return this.svc.listByPlace(
          Number(data.payload.placeId),
          data.page || 1,
          data.limit || 10,
        );

      case 'listByAccount':
        if (!data.payload?.accountId) {
          throw new BadRequestException('accountId é obrigatório.');
        }
        return this.svc.listByAccount(Number(data.payload.accountId));

      case 'add':
        if (!data.payload?.placeId || !data.payload?.accountId) {
          throw new BadRequestException('placeId e accountId são obrigatórios.');
        }
        return this.svc.add({
          placeId: Number(data.payload.placeId),
          accountId: Number(data.payload.accountId),
          rating: data.payload.rating ? Number(data.payload.rating) : undefined,
          comment: data.payload.comment,
        });

      case 'update':
        if (!data.payload?.id) {
          throw new BadRequestException('id do comentário é obrigatório.');
        }
        return this.svc.update(
          Number(data.payload.id),
          {
            rating: data.payload.rating ? Number(data.payload.rating) : undefined,
            comment: data.payload.comment,
          },
          data.payload.accountId ? Number(data.payload.accountId) : undefined,
        );

      case 'remove':
        if (!data.payload?.id) {
          throw new BadRequestException('id do comentário é obrigatório.');
        }
        await this.svc.remove(
          Number(data.payload.id),
          data.payload.accountId ? Number(data.payload.accountId) : undefined,
        );
        return { ok: true };

      case 'exists':
        if (!data.payload?.placeId || !data.payload?.accountId) {
          throw new BadRequestException('placeId e accountId são obrigatórios.');
        }
        return {
          exists: await this.svc.exists(
            Number(data.payload.accountId),
            Number(data.payload.placeId),
          ),
        };

      case 'getStats':
        if (!data.payload?.placeId) {
          throw new BadRequestException('placeId é obrigatório.');
        }
        return this.svc.getStats(Number(data.payload.placeId));

      default:
        throw new BadRequestException('Ação desconhecida.');
    }
  }
}