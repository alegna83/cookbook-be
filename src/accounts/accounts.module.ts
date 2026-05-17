import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { Account } from './account.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from '../auth/email.service';

@Module({
  imports: [TypeOrmModule.forFeature([Account])],
  providers: [AccountsService, EmailService],
  controllers: [AccountsController],
  exports: [AccountsService],
})
export class AccountsModule {}
