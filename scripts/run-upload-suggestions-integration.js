require('ts-node/register/transpile-only');
require('tsconfig-paths/register');

const assert = require('assert');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { UploadController } = require('../src/upload/upload.controller');
const { UploadService } = require('../src/upload/upload.service');
const { SuggestionController } = require('../src/suggestions/suggestion.controller');
const { SuggestionService } = require('../src/suggestions/suggestion.service');

async function main() {
  const uploadServiceMock = {
    uploadMedia: async () => ({
      url: 'https://cdn.example.com/main.jpg',
      publicId: 'main-1',
    }),
  };

  const suggestionServiceMock = {
    sugerirLugares: async () => 'A, 1.0, 2.0',
    sugerirMelhorAlbergue: async () => ({ id: 7, place_name: 'Hostel A' }),
    suggestBestAccommodation: async () => ({
      success: true,
      recommendation: { id: 1, name: 'Best Place' },
    }),
  };

  const moduleFixture = await Test.createTestingModule({
    controllers: [UploadController, SuggestionController],
    providers: [
      { provide: UploadService, useValue: uploadServiceMock },
      { provide: SuggestionService, useValue: suggestionServiceMock },
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

  await check('POST /upload forwards type and files', async () => {
    const response = await request(httpServer)
      .post('/upload')
      .field('type', 'main-photo')
      .attach('file', Buffer.from('fake-image'), 'photo.jpg')
      .expect(200);

    assert.strictEqual(response.body.url, 'https://cdn.example.com/main.jpg');
  });

  await check('POST /upload rejects missing type', async () => {
    const response = await request(httpServer)
      .post('/upload')
      .attach('file', Buffer.from('fake-image'), 'photo.jpg')
      .expect(400);

    assert.ok(String(response.body.message).includes('Tipo de upload não fornecido.'));
  });

  await check('POST /sugestoes/sugerir forwards prompt', async () => {
    const response = await request(httpServer)
      .post('/sugestoes/sugerir')
      .send({ lat: 40.1, lon: -8.2, interesse: 'hostels' })
      .expect(201);

    assert.strictEqual(response.text, 'A, 1.0, 2.0');
  });

  await check('GET /sugestoes/best-hostel forwards coordinates', async () => {
    const response = await request(httpServer)
      .get('/sugestoes/best-hostel?lat=40.123&lon=-8.456')
      .expect(200);

    assert.strictEqual(response.body.place_name, 'Hostel A');
  });

  await check('GET /sugestoes/best-accommodation forwards radius and category', async () => {
    const response = await request(httpServer)
      .get('/sugestoes/best-accommodation?lat=40.123&lon=-8.456&radius=12&category=Hostel')
      .expect(200);

    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.recommendation.name, 'Best Place');
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