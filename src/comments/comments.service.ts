import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Accommodation } from '../accommodations/entities/accommodation.entity';
import { Account } from '../accounts/account.entity';
import { ContentModerationService } from 'src/moderation/content-moderation.service';
import { EmailService } from 'src/auth/email.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private commentRepo: Repository<Comment>,
    @InjectRepository(Accommodation)
    private placeRepo: Repository<Accommodation>,
    @InjectRepository(Account)
    private accountRepo: Repository<Account>,
    private readonly moderationService: ContentModerationService,
    private readonly emailService: EmailService,
  ) {}

  private async notifyRequesterAboutDecision(options: {
    email?: string | null;
    name?: string | null;
    decision: 'approved' | 'rejected';
    placeName: string;
    reason?: string | null;
  }): Promise<void> {
    const recipient = options.email?.trim();

    if (!recipient) {
      return;
    }

    const decisionLabel = options.decision === 'approved' ? 'approved' : 'rejected';
    const subject = `Your comment was ${decisionLabel} - Stays4Pilgrims`;

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const reasonRow = options.reason?.trim()
      ? `
        <tr>
          <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">Reason</td>
          <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${escapeHtml(options.reason.trim())}</td>
        </tr>
      `
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="margin: 0 0 16px; color: #0f172a;">Your comment was ${escapeHtml(decisionLabel)}</h2>
        <p style="margin: 0 0 16px;">Hello ${escapeHtml(options.name?.trim() || 'there')}, your comment on <strong>${escapeHtml(options.placeName)}</strong> has been ${escapeHtml(decisionLabel)} by the admin team.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
          <tbody>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">Place</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${escapeHtml(options.placeName)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">Decision</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${escapeHtml(decisionLabel)}</td>
            </tr>
            ${reasonRow}
          </tbody>
        </table>
      </div>
    `;

    await this.emailService.sendCustomEmail(recipient, subject, html);
  }

  private async getAdminEmails(): Promise<string[]> {
    const admins = await this.accountRepo.find({ where: { userType: 'admin' } });

    return [...new Set(
      admins
        .map((admin) => admin.email?.trim())
        .filter((email): email is string => !!email),
    )];
  }

  private async notifyAdminsAboutPendingComment(comment: Comment, placeName: string): Promise<void> {
    try {
      const adminEmails = await this.getAdminEmails();

      if (adminEmails.length === 0) {
        return;
      }

      const subject = 'Pending comment review - Stays4Pilgrims';
      const html = `
        <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <h2 style="margin: 0 0 16px; color: #0f172a;">New comment pending review</h2>
          <p style="margin: 0 0 16px;">A new comment was submitted and is waiting for admin approval.</p>
          <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
            <tbody>
              <tr>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">Accommodation</td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${placeName || `Accommodation #${comment.placeId}`}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">Comment</td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${(comment.comment ?? '').toString().replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      await Promise.allSettled(
        adminEmails.map((email) => this.emailService.sendCustomEmail(email, subject, html)),
      );
    } catch (error) {
      console.error('[CommentsService] Failed to notify admins:', error);
    }
  }

  async add(dto: CreateCommentDto): Promise<Comment> {
    const place = await this.placeRepo.findOne({ where: { id: dto.placeId } });
    if (!place) throw new BadRequestException('Place não encontrado');

    const moderation = await this.moderationService.moderateComment(
      dto.comment ?? '',
    );

    if (moderation.decision === 'reject') {
      throw new BadRequestException(
        moderation.reason || 'Comment blocked by content moderation.',
      );
    }

    const comment = this.commentRepo.create(dto);
    comment.status = 'pending';
    comment.approvedAt = null;
    comment.rejectionReason = null;
    const saved = await this.commentRepo.save(comment);
    await this.notifyAdminsAboutPendingComment(saved, place.place_name ?? '');
    return saved;
  }

  async update(id: number, data: { rating?: number; comment?: string }, accountId?: number): Promise<Comment> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) throw new NotFoundException('Comentário não encontrado');
    
    if (accountId && comment.accountId !== accountId) {
      throw new ForbiddenException('Não tem permissão para editar este comentário');
    }

    let shouldNotifyAdmins = false;
    if (data.comment !== undefined) {
      const moderation = await this.moderationService.moderateComment(
        data.comment ?? '',
      );

      if (moderation.decision === 'reject') {
        throw new BadRequestException(
          moderation.reason || 'Comment blocked by content moderation.',
        );
      }

      comment.status = 'pending';
      comment.approvedAt = null;
      comment.rejectionReason = null;
      shouldNotifyAdmins = true;
    }

    Object.assign(comment, data);
    const saved = await this.commentRepo.save(comment);

    if (shouldNotifyAdmins) {
      const place = await this.placeRepo.findOne({ where: { id: comment.placeId } });
      await this.notifyAdminsAboutPendingComment(saved, place?.place_name ?? '');
    }

    return saved;
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
    const comment = await this.commentRepo.findOne({ where: { id }, relations: ['account', 'place'] });

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

    const saved = await this.commentRepo.save(comment);

    await this.notifyRequesterAboutDecision({
      email: comment.account?.email ?? null,
      name: comment.account?.name ?? null,
      decision: rejectionReason ? 'rejected' : 'approved',
      placeName: comment.place?.place_name ?? `Accommodation #${comment.placeId}`,
      reason: rejectionReason ?? null,
    });

    return saved;
  }
}