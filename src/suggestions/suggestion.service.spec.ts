import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { SuggestionService } from './suggestion.service';
import { AccommodationsService } from '../accommodations/accommodations.service';
import { CommentsService } from '../comments/comments.service';

describe('SuggestionService (unit)', () => {
  let service: SuggestionService;
  let httpServiceMock: { post: jest.Mock };
  let accommodationsMock: { getByBounds: jest.Mock };
  let commentsMock: { getStats: jest.Mock };

  beforeEach(async () => {
    httpServiceMock = { post: jest.fn() };
    accommodationsMock = { getByBounds: jest.fn() };
    commentsMock = { getStats: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionService,
        { provide: HttpService, useValue: httpServiceMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OPENROUTER_API_KEY') return 'test-key';
              if (key === 'OPENROUTER_MODEL') return 'openai/gpt-4o-mini';
              if (key === 'OPENROUTER_BASE_URL') return 'https://openrouter.ai/api/v1';
              if (key === 'OPENAI_BASE_URL') return undefined;
              return undefined;
            }),
          },
        },
        { provide: AccommodationsService, useValue: accommodationsMock },
        { provide: CommentsService, useValue: commentsMock },
      ],
    }).compile();

    service = module.get<SuggestionService>(SuggestionService);
  });

  it('sugerirLugares should return up to three coordinate lines from the model response', async () => {
    httpServiceMock.post.mockReturnValueOnce(
      of({
        data: {
          choices: [
            {
              message: {
                content: 'A, 1.0000, 2.0000\nB, 3.0000, 4.0000\nC, 5.0000, 6.0000\nD, 7.0000, 8.0000',
              },
            },
          ],
        },
      }),
    );

    const result = await service.sugerirLugares('test prompt');

    expect(result).toBe('A, 1.0000, 2.0000\nB, 3.0000, 4.0000\nC, 5.0000, 6.0000');
    expect(httpServiceMock.post).toHaveBeenCalledTimes(1);
  });

  it('suggestBestAccommodation should return the AI-matched accommodation when present in the list', async () => {
    accommodationsMock.getByBounds.mockResolvedValue([
      {
        id: 1,
        place_name: 'Alpha Hostel',
        address: 'Rua A',
        website: '',
        phone: '',
        email: '',
        latitude: 41,
        longitude: -8,
        services: ['wifi'],
        place_category: { name: 'Hostel' },
      },
      {
        id: 2,
        place_name: 'Beta Lodge',
        address: 'Rua B',
        website: '',
        phone: '',
        email: '',
        latitude: 41.1,
        longitude: -8.1,
        services: ['breakfast'],
        place_category: { name: 'Hostel' },
      },
    ]);
    commentsMock.getStats
      .mockResolvedValueOnce({ average: 4.4, count: 8 })
      .mockResolvedValueOnce({ average: 3.8, count: 4 });

    httpServiceMock.post.mockReturnValueOnce(
      of({
        data: {
          choices: [
            {
              message: {
                content: 'Alpha Hostel',
              },
            },
          ],
        },
      }),
    );

    const result = await service.suggestBestAccommodation(41.0, -8.0, 10, 'Hostel');

    expect(result.success).toBe(true);
    expect(result.recommendation.name).toBe('Alpha Hostel');
    expect(result.allOptions).toHaveLength(2);
  });

  it('suggestBestAccommodation should fall back to the highest-rated option when AI does not match a name', async () => {
    accommodationsMock.getByBounds.mockResolvedValue([
      {
        id: 1,
        place_name: 'Alpha Hostel',
        address: 'Rua A',
        website: '',
        phone: '',
        email: '',
        latitude: 41,
        longitude: -8,
        services: ['wifi'],
        place_category: { name: 'Hostel' },
      },
      {
        id: 2,
        place_name: 'Beta Lodge',
        address: 'Rua B',
        website: '',
        phone: '',
        email: '',
        latitude: 41.1,
        longitude: -8.1,
        services: ['breakfast'],
        place_category: { name: 'Hostel' },
      },
    ]);
    commentsMock.getStats
      .mockResolvedValueOnce({ average: 4.7, count: 12 })
      .mockResolvedValueOnce({ average: 3.9, count: 2 });

    httpServiceMock.post.mockReturnValueOnce(
      of({
        data: {
          choices: [
            {
              message: {
                content: 'Unknown place',
              },
            },
          ],
        },
      }),
    );

    const result = await service.suggestBestAccommodation(41.0, -8.0, 10, 'Hostel');

    expect(result.success).toBe(true);
    expect(result.recommendation.name).toBe('Alpha Hostel');
    expect(result.reasoning).toContain('12 guest reviews');
  });
});