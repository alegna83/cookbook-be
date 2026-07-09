require('ts-node/register/transpile-only');
require('tsconfig-paths/register');

const Module = require('module');
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (
    request.endsWith('/auth/email.service') ||
    request.endsWith('\\auth\\email.service') ||
    request.endsWith('email.service')
  ) {
    return {
      EmailService: class EmailService {},
    };
  }

  return originalLoad.apply(this, arguments);
};

const assert = require('assert');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { AuthController } = require('../src/auth/auth.controller');
const { AccountsService } = require('../src/accounts/accounts.service');
const { AuthService } = require('../src/auth/auth.service');
const { CommentsController } = require('../src/comments/comments.controller');
const { CommentsService } = require('../src/comments/comments.service');

async function main() {
  const authServiceMock = {
    login: async () => ({
      access_token: 'token-123',
      user: { id: 1, email: 'user@example.com' },
    }),
    handleAdminAction: async () => ({ ok: true }),
    logout: async () => undefined,
  };

  const accountsServiceMock = {
    register: async (email) => ({ id: 10, email }),
    verifyEmail: async () => ({ ok: true }),
    requestPasswordReset: async () => ({ ok: true }),
    resetPassword: async () => ({ ok: true }),
    resendVerificationEmail: async () => ({ ok: true }),
    changePassword: async () => ({ ok: true }),
  };

  const commentsServiceMock = {
    listByPlace: async () => [{ id: 1, comment: 'Great place' }],
    listByAccount: async () => [{ id: 2, comment: 'Another one' }],
    add: async (dto) => ({ id: 22, ...dto }),
    update: async (id, data) => ({ id, ...data }),
    remove: async () => undefined,
    exists: async () => true,
    getStats: async () => ({ average: 4.5, count: 2 }),
  };

  const moduleFixture = await Test.createTestingModule({
    controllers: [AuthController, CommentsController],
    providers: [
      { provide: AuthService, useValue: authServiceMock },
      { provide: AccountsService, useValue: accountsServiceMock },
      { provide: CommentsService, useValue: commentsServiceMock },
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  const httpServer = app.getHttpServer();
  const results = [];

  async function check(name, fn) {
    try {
      await fn();
      results.push({ name, status: 'passed' });
    } catch (error) {
      results.push({
        name,
        status: 'failed',
        error: error && error.message ? error.message : String(error),
      });
      throw error;
    }
  }

  await check('POST /auth/login forwards to AuthService', async () => {
    const response = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'secret' })
      .expect(200);

    assert.strictEqual(response.body.access_token, 'token-123');
    assert.strictEqual(response.body.user.email, 'user@example.com');
  });

  await check('POST /auth/register forwards to AccountsService', async () => {
    const response = await request(httpServer)
      .post('/auth/register')
      .send({
        email: 'new@example.com',
        name: 'New User',
        password: 'secret123',
        pilgrim_reason: 'tourism',
        pilgrim_reason_other: '',
      })
      .expect(201);

    assert.strictEqual(response.body.email, 'new@example.com');
  });

  await check('POST /comments/handle list action returns comments by place', async () => {
    const response = await request(httpServer)
      .post('/comments/handle')
      .send({ action: 'list', payload: { placeId: 7 }, page: 1, limit: 10 })
      .expect(200);

    assert.strictEqual(Array.isArray(response.body), true);
    assert.strictEqual(response.body[0].comment, 'Great place');
  });

  await check('POST /comments/handle add action returns created comment', async () => {
    const response = await request(httpServer)
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
      .expect(200);

    assert.strictEqual(response.body.comment, 'Nice');
    assert.strictEqual(response.body.placeId, 7);
  });

  await check('POST /comments/handle rejects missing placeId in list action', async () => {
    const response = await request(httpServer)
      .post('/comments/handle')
      .send({ action: 'list', payload: {} })
      .expect(400);

    assert.ok(String(response.body.message).includes('placeId é obrigatório.'));
  });

  await app.close();

  console.log(
    JSON.stringify(
      {
        success: true,
        numPassedTests: results.filter((item) => item.status === 'passed').length,
        numFailedTests: results.filter((item) => item.status === 'failed').length,
        numTotalTests: results.length,
        numPassedTestSuites: 1,
        numFailedTestSuites: 0,
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});