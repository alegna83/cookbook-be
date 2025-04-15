import { Controller, Get, Post, Body } from '@nestjs/common';
import { AccountsService } from './accounts.service';


@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('register')
  async register(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('pilgrim_reason') pilgrim_reason: string,
  ) {
    return this.accountsService.register(email, password, pilgrim_reason);
  }

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.accountsService.login(email, password);
  }
}
