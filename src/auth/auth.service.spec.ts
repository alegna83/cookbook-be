import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';
import { AccountsService } from '../accounts/accounts.service';
import { AccommodationsService } from '../accommodations/accommodations.service';
import { CommentsService } from '../comments/comments.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService (unit)', () => {
  let service: AuthService;
  let accountsMock: { findByEmail: jest.Mock };
  let commentsMock: { getPendingComments: jest.Mock };
  let jwtMock: { sign: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    accountsMock = { findByEmail: jest.fn() };
    commentsMock = { getPendingComments: jest.fn() };
    jwtMock = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verifyAsync: jest.fn().mockResolvedValue({ id: 1, email: 'a@b' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AccountsService, useValue: accountsMock },
        { provide: AccommodationsService, useValue: {} },
        { provide: CommentsService, useValue: commentsMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('login should return token and user when credentials valid', async () => {
    const passwordHash = bcrypt.hashSync('secret', 8);
    // @ts-ignore
    const accounts = (service as any).accountsService;
    accounts.findByEmail = jest.fn().mockResolvedValue({ id: 42, email: 'u@ex', password: passwordHash, name: 'User', isEmailVerified: true });

    const result = await service.login('u@ex', 'secret');

    expect(result).toHaveProperty('access_token', 'signed-token');
    expect(result).toHaveProperty('user');
    expect(result.user.id).toBe(42);
  });

  it('validateToken should return payload when token valid', async () => {
    const fakeReq: any = { headers: { authorization: 'Bearer abc' } };
    const payload = await service.validateToken(fakeReq as any);
    expect(payload).toEqual({ id: 1, email: 'a@b' });
  });

  it('handleAdminAction should delegate getpendingcomments to CommentsService', async () => {
    commentsMock.getPendingComments.mockResolvedValue([{ id: 7 }]);

    const result = await service.handleAdminAction({ action: 'getpendingcomments' } as any);

    expect(commentsMock.getPendingComments).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 7 }]);
  });

  it('login should reject when email is not verified', async () => {
    const passwordHash = bcrypt.hashSync('secret', 8);
    accountsMock.findByEmail = jest.fn().mockResolvedValue({ id: 1, email: 'u@ex', password: passwordHash, name: 'User', isEmailVerified: false });

    await expect(service.login('u@ex', 'secret')).rejects.toThrow('Please verify your email');
  });

  it('login should reject when password is invalid', async () => {
    const passwordHash = bcrypt.hashSync('correct', 8);
    accountsMock.findByEmail = jest.fn().mockResolvedValue({ id: 1, email: 'u@ex', password: passwordHash, name: 'User', isEmailVerified: true });

    await expect(service.login('u@ex', 'wrong')).rejects.toThrow('Invalid password');
  });
});
