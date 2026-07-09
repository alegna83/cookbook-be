import { createWorker } from 'tesseract.js';
import { ContentModerationService } from './content-moderation.service';

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
}));

describe('ContentModerationService (unit)', () => {
  const originalEnv = { ...process.env };
  const fetchMock = jest.fn();
  const recognizeMock = jest.fn();

  const setFetchMock = () => {
    (global as any).fetch = fetchMock;
  };

  const createService = () => new ContentModerationService();

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CONTENT_MODERATION_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.CONTENT_MODERATION_MODEL;

    fetchMock.mockReset();
    recognizeMock.mockReset();
    (createWorker as jest.Mock).mockReset();
    (createWorker as jest.Mock).mockResolvedValue({ recognize: recognizeMock });
    setFetchMock();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should allow blank comments locally', async () => {
    const service = createService();

    await expect(service.moderateComment('   ')).resolves.toEqual({
      target: 'comment',
      provider: 'local',
      decision: 'allow',
    });
  });

  it('should reject explicit comment text locally', async () => {
    const service = createService();

    const result = await service.moderateComment('This contains porn and should fail');

    expect(result.decision).toBe('reject');
    expect(result.reason).toContain('Sexual explicit or abusive content');
  });

  it('should review spam-like comments locally', async () => {
    const service = createService();

    const result = await service.moderateComment('Visit https://example.com or email TEST@EXAMPLE.COM!!!');

    expect(result.decision).toBe('review');
    expect(result.signals).toEqual(expect.arrayContaining(['contains_link', 'contains_email']));
  });

  it('should reject comments with excessive caps', async () => {
    const service = createService();

    const result = await service.moderateComment('THIS IS A VERY SHOUTY COMMENT THAT SHOULD REVIEW');

    expect(result.decision).toBe('review');
    expect(result.signals).toContain('excessive_caps');
  });

  it('should allow comments through OpenAI when flagged false', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ results: [{ flagged: false }] }),
    });

    await expect(service.moderateComment('A normal comment')).resolves.toEqual({
      target: 'comment',
      provider: 'openai',
      decision: 'allow',
    });
  });

  it('should reject comments through OpenAI when flagged true', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        results: [{ flagged: true, categories: { hate: true, violence: true } }],
      }),
    });

    const result = await service.moderateComment('A dangerous comment');

    expect(result.decision).toBe('reject');
    expect(result.reason).toContain('hate');
    expect(result.signals).toEqual(expect.arrayContaining(['hate', 'violence']));
  });

  it('should return local decision when OpenAI moderation response is not ok', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    fetchMock.mockResolvedValue({
      ok: false,
      json: jest.fn(),
    });

    const result = await service.moderateComment('normal comment');

    expect(result).toEqual({
      target: 'comment',
      provider: 'local',
      decision: 'allow',
    });
  });

  it('should return local decision when OpenAI moderation payload is empty', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ results: [] }),
    });

    const result = await service.moderateComment('normal comment');

    expect(result).toEqual({
      target: 'comment',
      provider: 'openai',
      decision: 'allow',
    });
  });

  it('should reject image urls when OpenAI moderation returns reject', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ decision: 'reject', reason: 'unsafe', confidence: 0.8 }) } }] }),
      });

    const result = await service.moderateImageUrls(['https://example.com/image.jpg']);

    expect(result.decision).toBe('reject');
    expect(result.reason).toBe('unsafe');
    expect(result.provider).toBe('openai');
  });

  it('should allow image urls when OpenAI moderation returns review', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ decision: 'review', reason: 'manual review' }) } }] }),
    });

    const result = await service.moderateImageUrls(['https://example.com/image.jpg']);

    expect(result.decision).toBe('allow');
    expect(result.provider).toBe('openai');
  });

  it('should reject image urls when OpenAI response returns forbidden visible text', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ decision: 'allow', visibleText: 'rape sign' }) } }] }),
    });

    const result = await service.moderateImageUrls(['https://example.com/image.jpg']);

    expect(result.decision).toBe('reject');
    expect(result.reason).toContain('Abusive or illegal text detected');
  });

  it('should review image urls when OpenAI request fails', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    fetchMock.mockRejectedValue(new Error('openai down'));

    const result = await service.moderateImageUrls(['https://example.com/image.jpg']);

    expect(result.decision).toBe('review');
    expect(result.provider).toBe('local');
  });

  it('should inspect multiple urls until a forbidden text is found', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    recognizeMock
      .mockResolvedValueOnce({ data: { text: 'clean text' } })
      .mockResolvedValueOnce({ data: { text: 'porn poster' } });

    const result = await service.moderateImageUrls([
      'https://example.com/clean.jpg',
      'https://example.com/bad.jpg',
    ]);

    expect(result.decision).toBe('reject');
    expect(result.visibleText).toContain('porn poster');
  });

  it('should allow image buffers when the buffer list is empty after filtering', async () => {
    const service = createService();

    const result = await service.moderateImageBuffers([Buffer.from(''), null as any]);

    expect(result).toEqual({
      target: 'image',
      provider: 'local',
      decision: 'allow',
    });
  });

  it('should return empty text when OCR throws for urls', async () => {
    const service = createService();
    recognizeMock.mockRejectedValue(new Error('ocr failed'));

    const result = await service.moderateImageUrls(['https://example.com/image.jpg']);

    expect(result.decision).toBe('review');
  });

  it('should return empty text when OCR throws for buffers', async () => {
    const service = createService();
    recognizeMock.mockRejectedValue(new Error('ocr failed'));

    const result = await service.moderateImageBuffers([Buffer.from('image-data')]);

    expect(result).toEqual({
      target: 'image',
      provider: 'local',
      decision: 'allow',
    });
  });

  it('should fall back to local moderation when OpenAI fails', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    fetchMock.mockRejectedValue(new Error('network down'));

    const result = await service.moderateComment('normal comment');

    expect(result).toEqual({
      target: 'comment',
      provider: 'local',
      decision: 'allow',
    });
  });

  it('should allow empty image url lists', async () => {
    const service = createService();

    await expect(service.moderateImageUrls(['   ', ''])).resolves.toEqual({
      target: 'image',
      provider: 'local',
      decision: 'allow',
    });
  });

  it('should reject image urls when OCR finds explicit text', async () => {
    const service = createService();
    recognizeMock.mockResolvedValue({ data: { text: 'porn inside image' } });

    const result = await service.moderateImageUrls(['https://example.com/image.jpg']);

    expect(result.decision).toBe('reject');
    expect(result.reason).toContain('Sexually explicit text detected');
    expect(createWorker).toHaveBeenCalledWith('eng');
  });

  it('should return review when image moderation is local only and OCR is clean', async () => {
    const service = createService();
    recognizeMock.mockResolvedValue({ data: { text: 'clean text' } });

    const result = await service.moderateImageUrls(['https://example.com/image.jpg']);

    expect(result.decision).toBe('review');
    expect(result.provider).toBe('local');
  });

  it('should allow image buffers when OCR is clean', async () => {
    const service = createService();
    recognizeMock.mockResolvedValue({ data: { text: 'clean text' } });

    const result = await service.moderateImageBuffers([Buffer.from('image-data')]);

    expect(result).toEqual({
      target: 'image',
      provider: 'local',
      decision: 'allow',
    });
  });

  it('should reject image buffers when OCR finds illegal text', async () => {
    const service = createService();
    recognizeMock.mockResolvedValue({ data: { text: 'csam' } });

    const result = await service.moderateImageBuffers([Buffer.from('image-data')]);

    expect(result.decision).toBe('reject');
    expect(result.reason).toContain('Abusive or illegal text detected');
  });

  it('should allow image moderation via OpenAI when decision is allow', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'allow',
                confidence: 0.99,
                signals: ['ok'],
                visibleText: 'clean',
              }),
            },
          },
        ],
      }),
    });

    const result = await service.moderateImageUrls(['https://example.com/image.jpg']);

    expect(result.decision).toBe('allow');
    expect(result.provider).toBe('openai');
  });

  it('should reject image moderation via OpenAI when visible text matches a forbidden pattern', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'allow',
                visibleText: 'porn sign',
              }),
            },
          },
        ],
      }),
    });

    const result = await service.moderateImageUrls(['https://example.com/image.jpg']);

    expect(result.decision).toBe('reject');
    expect(result.reason).toContain('Sexually explicit text detected');
  });

  it('should return review when OpenAI image response is empty', async () => {
    process.env.CONTENT_MODERATION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const service = createService();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ choices: [{ message: { content: '' } }] }),
    });

    const result = await service.moderateImageUrls(['https://example.com/image.jpg']);

    expect(result.decision).toBe('review');
    expect(result.provider).toBe('local');
  });
});