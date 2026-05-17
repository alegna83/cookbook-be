import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { HandleAdminDto } from './dto/handle-admin.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { Response, Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AccountsService } from '../accounts/accounts.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountsService: AccountsService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(
      loginDto.email,
      loginDto.password,
    );
    return result || { message: 'Invalid credentials' };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204) // Protege o logout, só faz se estiver autenticado
  async logout(@Req() req: Request, @Res() res: Response) {
    // Opcional: Adicionar o token à blacklist no backend
    console.log('req::', req);

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ message: 'Token não fornecido.' });
    }
    await this.authService.logout(req);

    // Expirar o token no cliente (removendo o cookie, se usado)
    res.clearCookie('jwt');
    return res.status(200).json({ message: 'Logout successful' });
  }

  @Post('register')
  @HttpCode(201)
  async register(@Body() registerDto: RegisterDto) {
    return this.accountsService.register(
      registerDto.email,
      registerDto.name,
      registerDto.password,
      registerDto.pilgrim_reason,
      registerDto.pilgrim_reason_other,
    );
  }

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() verifyDto: VerifyEmailDto) {
    return this.accountsService.verifyEmail(verifyDto.token);
  }

  @Post('resend-verification')
  @HttpCode(200)
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.accountsService.resendVerificationEmail(resendDto.email);
  }

  // 🔐 Admin endpoint encapsulado
  @Post('admin/handle')
  @HttpCode(200)
  async handleAdmin(@Body() data: HandleAdminDto): Promise<any> {
    return this.authService.handleAdminAction(data);
  }
}
