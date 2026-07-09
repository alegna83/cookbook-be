import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { UploadController } from '../src/upload/upload.controller';
import { UploadService } from '../src/upload/upload.service';
import { SuggestionController } from '../src/suggestions/suggestion.controller';
import { SuggestionService } from '../src/suggestions/suggestion.service';

describe('Upload and Suggestions integration', () => {
  let app: INestApplication<App>;
  let uploadServiceMock: { uploadMedia: jest.Mock };
  let suggestionServiceMock: {
    sugerirLugares: jest.Mock;
    sugerirMelhorAlbergue: jest.Mock;
    suggestBestAccommodation: jest.Mock;
  };

  beforeEach(async () => {
    uploadServiceMock = {
      uploadMedia: jest.fn(),
    };

    suggestionServiceMock = {
      sugerirLugares: jest.fn(),
      sugerirMelhorAlbergue: jest.fn(),
      suggestBestAccommodation: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UploadController, SuggestionController],
      providers: [
        { provide: UploadService, useValue: uploadServiceMock },
        { provide: SuggestionService, useValue: suggestionServiceMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('POST /upload should forward files and type to UploadService', async () => {
    uploadServiceMock.uploadMedia.mockResolvedValue({
      url: 'https://cdn.example.com/main.jpg',
      publicId: 'main-1',
    });

    await request(app.getHttpServer())
      .post('/upload')
      .field('type', 'main-photo')
      .attach('file', Buffer.from('fake-image'), 'photo.jpg')
      .expect(200)
      .expect(({ body }) => {
        expect(body.url).toBe('https://cdn.example.com/main.jpg');
        expect(body.publicId).toBe('main-1');
      });

    expect(uploadServiceMock.uploadMedia).toHaveBeenCalledTimes(1);
    expect(uploadServiceMock.uploadMedia.mock.calls[0][1]).toBe('main-photo');
    expect(uploadServiceMock.uploadMedia.mock.calls[0][0]).toHaveLength(1);
  });

  it('POST /upload should reject requests without type', async () => {
    await request(app.getHttpServer())
      .post('/upload')
      .attach('file', Buffer.from('fake-image'), 'photo.jpg')
      .expect(400)
      .expect(({ body }) => {
        expect(String(body.message)).toContain('Tipo de upload não fornecido.');
      });
  });

  it('POST /upload should reject requests without files', async () => {
    await request(app.getHttpServer())
      .post('/upload')
      .field('type', 'avatar')
      .expect(400)
      .expect(({ body }) => {
        expect(String(body.message)).toContain('Nenhum ficheiro fornecido.');
      });
  });

  it('POST /sugestoes/sugerir should forward prompt to SuggestionService', async () => {
    suggestionServiceMock.sugerirLugares.mockResolvedValue('A, 1.0, 2.0');

    await request(app.getHttpServer())
      .post('/sugestoes/sugerir')
      .send({ lat: 40.1, lon: -8.2, interesse: 'hostels' })
      .expect(201)
      .expect(({ text }) => {
        expect(text).toBe('A, 1.0, 2.0');
      });

    expect(suggestionServiceMock.sugerirLugares).toHaveBeenCalledTimes(1);
    expect(suggestionServiceMock.sugerirLugares.mock.calls[0][0]).toContain('latitude 40.1');
    expect(suggestionServiceMock.sugerirLugares.mock.calls[0][0]).toContain('longitude -8.2');
  });

  it('GET /sugestoes/best-hostel should forward coordinates to SuggestionService', async () => {
    suggestionServiceMock.sugerirMelhorAlbergue.mockResolvedValue({ id: 7, place_name: 'Hostel A' });

    await request(app.getHttpServer())
      .get('/sugestoes/best-hostel?lat=40.123&lon=-8.456')
      .expect(200)
      .expect(({ body }) => {
        expect(body.place_name).toBe('Hostel A');
      });

    expect(suggestionServiceMock.sugerirMelhorAlbergue).toHaveBeenCalledWith(40.123, -8.456);
  });

  it('GET /sugestoes/best-accommodation should forward radius and category to SuggestionService', async () => {
    suggestionServiceMock.suggestBestAccommodation.mockResolvedValue({
      success: true,
      recommendation: { id: 1, name: 'Best Place' },
    });

    await request(app.getHttpServer())
      .get('/sugestoes/best-accommodation?lat=40.123&lon=-8.456&radius=12&category=Hostel')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.recommendation.name).toBe('Best Place');
      });

    expect(suggestionServiceMock.suggestBestAccommodation).toHaveBeenCalledWith(
      40.123,
      -8.456,
      12,
      'Hostel',
    );
  });
});