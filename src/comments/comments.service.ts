import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Place } from '../places/entities/place.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private commentRepo: Repository<Comment>,
    @InjectRepository(Place)
    private placeRepo: Repository<Place>,
  ) {}

  async add(dto: CreateCommentDto): Promise<Comment> {
    const place = await this.placeRepo.findOne({ where: { id: dto.placeId } });
    if (!place) throw new BadRequestException('Place não encontrado');

    const comment = this.commentRepo.create(dto);
    return this.commentRepo.save(comment);
  }

  async update(id: number, data: { rating?: number; comment?: string }, accountId?: number): Promise<Comment> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) throw new NotFoundException('Comentário não encontrado');
    
    if (accountId && comment.accountId !== accountId) {
      throw new ForbiddenException('Não tem permissão para editar este comentário');
    }

    Object.assign(comment, data);
    return this.commentRepo.save(comment);
  }

  async remove(id: number, accountId?: number): Promise<void> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) throw new NotFoundException('Comentário não encontrado');
    
    if (accountId && comment.accountId !== accountId) {
      throw new ForbiddenException('Não tem permissão para eliminar este comentário');
    }
    
    await this.commentRepo.remove(comment);
  }

  async listByPlace(placeId: number, page: number = 1, limit: number = 10): Promise<Comment[]> {
    return this.commentRepo.find({
      where: { placeId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async listByAccount(accountId: number): Promise<Comment[]> {
    return this.commentRepo.find({
      where: { accountId },
      order: { createdAt: 'DESC' },
    });
  }

  async exists(accountId: number, placeId: number): Promise<boolean> {
    const comment = await this.commentRepo.findOne({ where: { accountId, placeId } });
    return !!comment;
  }

  async getStats(placeId: number): Promise<{ average: number; count: number }> {
    const result = await this.commentRepo
      .createQueryBuilder('comment')
      .select('AVG(comment.rating)', 'average')
      .addSelect('COUNT(comment.id)', 'count')
      .where('comment.placeId = :placeId', { placeId })
      .getRawOne();
    
    return {
      average: result?.average ? parseFloat(result.average) : 0,
      count: result?.count ? parseInt(result.count) : 0,
    };
  }
}