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
        if (!data.payload?.id) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.approveAccommodation(
          data.payload.id,
        );

      case 'rejectaccommodation':
        if (!data.payload?.id) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.approveAccommodation(
          data.payload.id,
          data.payload.rejectionReason,
        );

      case 'approvecomment':
        if (!data.payload?.id) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.commentsService.approveComment(data.payload.id);

      case 'rejectcomment':
        if (!data.payload?.id) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.commentsService.approveComment(
          data.payload.id,
          data.payload.rejectionReason,
        );

      case 'approvephoto':
        if (!data.payload?.id) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.approvePhoto(data.payload.id);

      case 'rejectphoto':
        if (!data.payload?.id) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.rejectPhoto(
          data.payload.id,
          data.payload.rejectionReason,
        );

      case 'approveremovalrequest':
        if (!data.payload?.id) {
          throw new BadRequestException('ID é obrigatório.');
        }
        try {
          return await this.accommodationsService.approveRemovalRequest(data.payload.id);
        } catch (e) {
          console.error('Error approving removal request:', e);
          throw e;
        }

      case 'getpendingedits':
        return this.accommodationsService.getPendingEditRequests();

      case 'approveedit':
        if (!data.payload?.id) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.approveEditRequest(data.payload.id);

      case 'rejectedit':
        if (!data.payload?.id) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.rejectEditRequest(
          data.payload.id,
          data.payload.rejectionReason,
        );

      case 'rejectremovalrequest':
      case 'rejectremoval':
        if (!data.payload?.id) {
          throw new BadRequestException('ID é obrigatório.');
        }
        return this.accommodationsService.rejectRemovalRequest(
          data.payload.id,
          data.payload.rejectionReason,
        );

      default:
        throw new BadRequestException('Ação desconhecida.');
    }
  }
}
