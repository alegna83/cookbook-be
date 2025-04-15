import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto'; // Criar o DTO para o login
import { Response, Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
