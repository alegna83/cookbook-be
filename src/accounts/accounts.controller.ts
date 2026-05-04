import { Controller, Get, Post, Body } from '@nestjs/common';
import { AccountsService } from './accounts.service';


@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('register')
  async register(
    @Body('email') email: string,
    @Body('name') name: string,
    @Body('password') password: string,
    @Body('pilgrim_reason') pilgrim_reason: string,
  ) {
    return this.accountsService.register(email, name, password, pilgrim_reason);
  }

  @Post('update')
  async update(
    @Body('accountId') accountId: number,
    @Body('name') name: string,
    @Body('pilgrim_reason') pilgrim_reason: string,
    @Body('avatar') avatar: string,
  ) {
    return this.accountsService.updateAccount(accountId, {
      name,
      pilgrim_reason,
      avatar,
    } as any);
  }

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.accountsService.login(email, password);
  }
}
