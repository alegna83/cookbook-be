import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Accommodation } from '../accommodations/entities/accommodation.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private commentRepo: Repository<Comment>,
    @InjectRepository(Accommodation)
    private placeRepo: Repository<Accommodation>,
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

  async listByPlace(placeId: number, page: number = 1, limit: number = 10): Promise<any[]> {
    const comments = await this.commentRepo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.account', 'account')
      .where('comment.placeId = :placeId', { placeId })
      .orderBy('comment.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // Mapear para incluir accountName
    return comments.map(comment => ({
      ...comment,
      accountName: comment.account?.name || null,
      account: undefined, // Remove o objeto account completo
    }));
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

  // ✅ Admin approval methods
  async getPendingComments(): Promise<any[]> {
    const comments = await this.commentRepo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.place', 'place')
      .leftJoinAndSelect('comment.account', 'account')
      .where('comment.status = :status', { status: 'pending' })
      .orderBy('comment.createdAt', 'ASC')
      .getMany();

    // Mapear para incluir placeName e dados do user no nível do comentário
    return comments.map(comment => ({
      ...comment,
      placeName: comment.place?.place_name || null,
      accountName: comment.account?.name || null,
      accountEmail: comment.account?.email || null,
      place: undefined, // Remove o objeto place completo
      account: undefined, // Remove o objeto account completo
    }));
  }

  async approveComment(
    id: number,
    rejectionReason?: string,
  ): Promise<Comment> {
    const comment = await this.commentRepo.findOne({ where: { id } });

    if (!comment) {
      throw new NotFoundException('Comentário não encontrado');
    }

    if (rejectionReason) {
      comment.status = 'rejected';
      comment.rejectionReason = rejectionReason;
    } else {
      comment.status = 'approved';
      comment.approvedAt = new Date();
    }

    return this.commentRepo.save(comment);
  }
}