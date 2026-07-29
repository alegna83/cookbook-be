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

  private extractAccountId(payload?: Record<string, any>): number | undefined {
    const rawAccountId =
      payload?.accountId ??
      payload?.account_id ??
      payload?.userId ??
      payload?.ownerId;

    if (rawAccountId === undefined || rawAccountId === null || rawAccountId === '') {
      return undefined;
    }

    const accountId = Number(rawAccountId);
    return Number.isInteger(accountId) ? accountId : undefined;
  }

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
        {
        const accountId = this.extractAccountId(data.payload);
        if (!accountId) {
          throw new BadRequestException('accountId é obrigatório.');
        }
        return this.svc.listByAccount(accountId);
        }

      case 'add':
        {
        const accountId = this.extractAccountId(data.payload);
        if (!data.payload?.placeId || !accountId) {
          throw new BadRequestException('placeId e accountId são obrigatórios.');
        }
        return this.svc.add({
          placeId: Number(data.payload.placeId),
          accountId,
          rating: data.payload.rating ? Number(data.payload.rating) : undefined,
          comment: data.payload.comment,
        });
        }

      case 'update':
        if (!data.payload?.id) {
          throw new BadRequestException('id do comentário é obrigatório.');
        }
        {
        const accountId = this.extractAccountId(data.payload);
        return this.svc.update(
          Number(data.payload.id),
          {
            rating: data.payload.rating ? Number(data.payload.rating) : undefined,
            comment: data.payload.comment,
          },
          accountId,
        );
        }

      case 'remove':
        if (!data.payload?.id) {
          throw new BadRequestException('id do comentário é obrigatório.');
        }
        {
        const accountId = this.extractAccountId(data.payload);
        await this.svc.remove(
          Number(data.payload.id),
          accountId,
        );
        return { ok: true };
        }

      case 'exists':
        {
        const accountId = this.extractAccountId(data.payload);
        if (!data.payload?.placeId || !accountId) {
          throw new BadRequestException('placeId e accountId são obrigatórios.');
        }
        return {
          exists: await this.svc.exists(
            accountId,
            Number(data.payload.placeId),
          ),
        };
        }

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