import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AccountsService } from '../src/accounts/accounts.service';
import { AuthService } from '../src/auth/auth.service';
import { CommentsController } from '../src/comments/comments.controller';
import { CommentsService } from '../src/comments/comments.service';

jest.mock('../src/auth/email.service', () => ({
  EmailService: class EmailService {},
}));

describe('Auth and Comments integration', () => {
  let app: INestApplication<App>;
  let authServiceMock: {
    login: jest.Mock;
    handleAdminAction: jest.Mock;
    logout: jest.Mock;
  };
  let accountsServiceMock: {
    register: jest.Mock;
    verifyEmail: jest.Mock;
    requestPasswordReset: jest.Mock;
    resetPassword: jest.Mock;
    resendVerificationEmail: jest.Mock;
    changePassword: jest.Mock;
  };
  let commentsServiceMock: {
    listByPlace: jest.Mock;
    listByAccount: jest.Mock;
    add: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    exists: jest.Mock;
    getStats: jest.Mock;
  };

  beforeEach(async () => {
    authServiceMock = {
      login: jest.fn(),
      handleAdminAction: jest.fn(),
      logout: jest.fn(),
    };
    accountsServiceMock = {
      register: jest.fn(),
      verifyEmail: jest.fn(),
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
      resendVerificationEmail: jest.fn(),
      changePassword: jest.fn(),
    };
    commentsServiceMock = {
      listByPlace: jest.fn(),
      listByAccount: jest.fn(),
      add: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      exists: jest.fn(),
      getStats: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, CommentsController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: AccountsService, useValue: accountsServiceMock },
        { provide: CommentsService, useValue: commentsServiceMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('POST /auth/login should forward credentials to AuthService and return its response', async () => {
    authServiceMock.login.mockResolvedValue({
      access_token: 'token-123',
      user: { id: 1, email: 'user@example.com' },
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'secret' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.access_token).toBe('token-123');
        expect(body.user.email).toBe('user@example.com');
      });

    expect(authServiceMock.login).toHaveBeenCalledWith('user@example.com', 'secret');
  });

  it('POST /auth/register should forward payload to AccountsService', async () => {
    accountsServiceMock.register.mockResolvedValue({
      id: 10,
      email: 'new@example.com',
    });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'new@example.com',
        name: 'New User',
        password: 'secret123',
        pilgrim_reason: 'tourism',
        pilgrim_reason_other: '',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.email).toBe('new@example.com');
      });

    expect(accountsServiceMock.register).toHaveBeenCalledWith(
      'new@example.com',
      'New User',
      'secret123',
      'tourism',
      '',
    );
  });

  it('POST /comments/handle should list comments by place', async () => {
    commentsServiceMock.listByPlace.mockResolvedValue([{ id: 1, comment: 'Great place' }]);

    await request(app.getHttpServer())
      .post('/comments/handle')
      .send({ action: 'list', payload: { placeId: 7 }, page: 1, limit: 10 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].comment).toBe('Great place');
      });

    expect(commentsServiceMock.listByPlace).toHaveBeenCalledWith(7, 1, 10);
  });

  it('POST /comments/handle should add a comment through CommentsService', async () => {
    commentsServiceMock.add.mockResolvedValue({ id: 22, comment: 'Nice' });

    await request(app.getHttpServer())
      .post('/comments/handle')
      .send({
        action: 'add',
        payload: {
          placeId: 7,
          accountId: 3,
          rating: 4.5,
          comment: 'Nice',
        },
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.comment).toBe('Nice');
      });

    expect(commentsServiceMock.add).toHaveBeenCalledWith({
      placeId: 7,
      accountId: 3,
      rating: 4.5,
      comment: 'Nice',
    });
  });

  it('POST /comments/handle should reject missing payload data for list action', async () => {
    await request(app.getHttpServer())
      .post('/comments/handle')
      .send({ action: 'list', payload: {} })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toContain('placeId é obrigatório.');
      });
  });
});