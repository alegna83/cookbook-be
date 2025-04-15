import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccountsModule } from '../accounts/accounts.module'; // Importe o AccountsModule
import { JwtStrategy } from './guards/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // Pegando a chave secreta do arquivo .env
        signOptions: { expiresIn: '60m' }, // Definindo a expiração do token, ajustável
      }),
    }),
    AccountsModule,
  ], // Importando o módulo que contém o AccountsService
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
