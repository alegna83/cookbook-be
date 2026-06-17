import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Account } from './account.entity';
import { EmailService } from '../auth/email.service';

describe('AccountsService', () => {
  let service: AccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: getRepositoryToken(Account), useValue: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() } },
        { provide: EmailService, useValue: { sendEmailVerificationEmail: jest.fn(), sendWelcomeEmail: jest.fn(), sendPasswordResetEmail: jest.fn() } },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
