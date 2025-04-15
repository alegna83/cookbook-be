import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AccountsService } from '../accounts/accounts.service';
import { JwtService } from '@nestjs/jwt';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private accountsService: AccountsService,
    private jwtService: JwtService,
  ) {}

  private tokenBlacklist: Set<string> = new Set();

  async login(email: string, password: string) {
    console.log('Login do auth service');
    // Verifique se o usuário existe
    const account = await this.accountsService.findByEmail(email);
    if (!account) {
      throw new Error('Email not found');
    }

    // Verifique se a senha está correta
    const isPasswordValid = await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
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

    return { access_token, user: account };
  }

  async validateToken(req: Request) {
    const token = req.headers['authorization']?.split(' ')[1]; // Extrai o token após "Bearer "
    if (!token) {
      throw new Error('Token não fornecido.');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token); // Usa o verifyAsync para tratar assíncronamente
      return payload;
    } catch (e) {
      throw new Error('Token inválido.');
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
}
