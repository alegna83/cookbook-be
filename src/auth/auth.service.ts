import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AccountsService } from '../accounts/accounts.service';
import { AccommodationsService } from '../accommodations/accommodations.service';
import { CommentsService } from '../comments/comments.service';
import { JwtService } from '@nestjs/jwt';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { HandleAdminDto } from './dto/handle-admin.dto';

@Injectable()
export class AuthService {
  constructor(
    private accountsService: AccountsService,
    private accommodationsService: AccommodationsService,
    private commentsService: CommentsService,
    private jwtService: JwtService,
  ) {}

  private tokenBlacklist: Set<string> = new Set();

  async login(email: string, password: string) {
    console.log('Login do auth service');
    // Verifique se o usuário existe
    const account = await this.accountsService.findByEmail(email);
    if (!account) {
      throw new UnauthorizedException('Email not found');
    }

    // Verificar se o email foi verificado
    if (!account.isEmailVerified) {
      throw new BadRequestException('Please verify your email before logging in.');
    }

    // Verifique se a senha está correta
    const isPasswordValid = await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    /*return {
      access_token: jwt.sign(
        { id: account.id, email: account.email },
        'chave-secreta',
        { expiresIn: '1h' },
      ),
    };*/
    const payload = { id: account.id, email: account.email };
    const access_token = this.jwtService.sign(payload, { expiresIn: '1h' });

    // Retorna o nome do usuário, ou a primeira parte do email se não tiver nome
    let userName = account.name;
    if (!userName || userName.trim() === '') {
      userName = account.email.split('@')[0];
    }

    return { 
      access_token, 
      user: {
        ...account,
        name: userName
      }
    };
  }

  async validateToken(req: Request) {
    const token = req.headers['authorization']?.split(' ')[1]; // Extrai o token após "Bearer "
    if (!token) {
      throw new BadRequestException('Token não fornecido.');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token); // Usa o verifyAsync para tratar assíncronamente
      return payload;
    } catch (e) {
      throw new UnauthorizedException('Token inválido.');
    }
  }

  /*async logout(user: any) {
    this.tokenBlacklist.add(user.token);
  }*/

  logout(req: Request) {
    console.log('Auth Header:', req.headers['authorization']);

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      throw new Error('Token não encontrado.');
    }

    const token = authHeader.split(' ')[1]; // Remove "Bearer "
    this.tokenBlacklist.add(token);
  }

  isTokenBlacklisted(token: string): boolean {
    return this.tokenBlacklist.has(token);
  }

  private extractAdminEntityId(payload?: Record<string, any>): number | null {
    const rawId =
      payload?.id ??
      payload?.commentId ??
      payload?.photoId ??
      payload?.requestId ??
      payload?.accommodationId ??
      payload?.placeId;

    const id = Number(rawId);
    return Number.isInteger(id) ? id : null;
  }

  private extractRejectionReason(payload?: Record<string, any>): string {
    const reason = payload?.rejectionReason ?? payload?.reason;
    return reason?.toString().trim() || 'Rejected by admin.';
  }

  // 🔐 Admin actions handler
  async handleAdminAction(data: HandleAdminDto): Promise<any> {
    const normalizedAction = (data.action ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[-_\s]/g, '');

    switch (normalizedAction) {
      case 'getpendingaccommodations':
        return this.accommodationsService.getPendingAccommodations();

      case 'getpendingcomments':
        return this.commentsService.getPendingComments();

      case 'getpendingremovalrequests':
      case 'getremovalrequests':
        return this.accommodationsService.getPendingRemovalRequests();

      case 'getpendingphotos':
      case 'getpendinggalleryphotos':
        return this.accommodationsService.getPendingPhotos();

      case 'approveaccommodation':
        {
        const accommodationId = this.extractAdminEntityId(data.payload);
        if (!accommodationId) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.approveAccommodation(
          accommodationId,
        );
        }

      case 'rejectaccommodation':
        {
        const accommodationId = this.extractAdminEntityId(data.payload);
        if (!accommodationId) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.approveAccommodation(
          accommodationId,
          this.extractRejectionReason(data.payload),
        );
        }

      case 'approvecomment':
        {
        const commentId = this.extractAdminEntityId(data.payload);
        if (!commentId) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.commentsService.approveComment(commentId);
        }

      case 'rejectcomment':
        {
        const commentId = this.extractAdminEntityId(data.payload);
        if (!commentId) {
          throw new BadRequestException('ID é obrigatório.');
        }

        return this.commentsService.approveComment(
          commentId,
          this.extractRejectionReason(data.payload),
        );
        }

      case 'approvephoto':
        {
        const photoId = this.extractAdminEntityId(data.payload);
        if (!photoId) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.approvePhoto(photoId);
        }

      case 'rejectphoto':
        {
        const photoId = this.extractAdminEntityId(data.payload);
        if (!photoId) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.rejectPhoto(
          photoId,
          this.extractRejectionReason(data.payload),
        );
        }

      case 'approveremovalrequest':
        {
        const requestId = this.extractAdminEntityId(data.payload);
        if (!requestId) {
          throw new BadRequestException('ID é obrigatório.');
        }
        try {
          return await this.accommodationsService.approveRemovalRequest(requestId);
        } catch (e) {
          console.error('Error approving removal request:', e);
          throw e;
        }
        }

      case 'getpendingedits':
        return this.accommodationsService.getPendingEditRequests();

      case 'approveedit':
        {
        const requestId = this.extractAdminEntityId(data.payload);
        if (!requestId) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.approveEditRequest(requestId);
        }

      case 'rejectedit':
        {
        const requestId = this.extractAdminEntityId(data.payload);
        if (!requestId) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.rejectEditRequest(
          requestId,
          this.extractRejectionReason(data.payload),
        );
        }

      case 'rejectremovalrequest':
      case 'rejectremoval':
        {
        const requestId = this.extractAdminEntityId(data.payload);
        if (!requestId) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.rejectRemovalRequest(
          requestId,
          this.extractRejectionReason(data.payload),
        );
        }

      default:
        throw new BadRequestException('Ação desconhecida.');
    }
  }
}
