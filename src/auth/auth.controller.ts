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
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { HandleAdminDto } from './dto/handle-admin.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
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
  @Throttle({ burst: { limit: 5, ttl: 10_000 }, sustained: { limit: 60, ttl: 3_600_000 } })
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(
      loginDto.email,
      loginDto.password,
    );
    return result || { message: 'Invalid credentials' };
  }

  @Post('logout')
  @Throttle({ burst: { limit: 5, ttl: 10_000 }, sustained: { limit: 60, ttl: 3_600_000 } })
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
  @Throttle({ burst: { limit: 5, ttl: 10_000 }, sustained: { limit: 60, ttl: 3_600_000 } })
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
  @Throttle({ burst: { limit: 5, ttl: 10_000 }, sustained: { limit: 60, ttl: 3_600_000 } })
  @HttpCode(200)
  async verifyEmail(@Body() verifyDto: VerifyEmailDto) {
    return this.accountsService.verifyEmail(verifyDto.token);
  }

  @Post('request-password-reset')
  @Throttle({ burst: { limit: 5, ttl: 10_000 }, sustained: { limit: 60, ttl: 3_600_000 } })
  @HttpCode(200)
  async requestPasswordReset(@Body() body: any) {
    return this.accountsService.requestPasswordReset(body.email);
  }

  @Post('reset-password')
  @Throttle({ burst: { limit: 5, ttl: 10_000 }, sustained: { limit: 60, ttl: 3_600_000 } })
  @HttpCode(200)
  async resetPassword(@Body() body: any) {
    return this.accountsService.resetPassword(body.token, body.newPassword);
  }

  @Post('resend-verification')
  @Throttle({ burst: { limit: 5, ttl: 10_000 }, sustained: { limit: 60, ttl: 3_600_000 } })
  @HttpCode(200)
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    console.log('[AuthController] resendVerification called for', resendDto?.email);
    return this.accountsService.resendVerificationEmail(resendDto.email);
  }

  @Post('change-password')
  @Throttle({ burst: { limit: 5, ttl: 10_000 }, sustained: { limit: 60, ttl: 3_600_000 } })
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    // req.user is the validated JWT payload (see JwtStrategy)
    const user: any = (req as any).user;
    if (!user || !user.id) {
      throw new BadRequestException('Invalid token payload.');
    }

    return this.accountsService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  // 🔐 Admin endpoint encapsulado
  @Post('admin/handle')
  @Throttle({ burst: { limit: 5, ttl: 10_000 }, sustained: { limit: 60, ttl: 3_600_000 } })
  @HttpCode(200)
  async handleAdmin(@Body() data: HandleAdminDto): Promise<any> {
    return this.authService.handleAdminAction(data);
  }
}
