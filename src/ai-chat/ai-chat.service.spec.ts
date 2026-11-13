import { AiChatService } from './ai-chat.service';
import { ChatSessionStore } from './chat-session.store';

const retrievers: any[] = [];

describe('AiChatService domain guard', () => {
  let service: AiChatService;

  beforeEach(() => {
    service = new AiChatService(new ChatSessionStore(), retrievers);
  });

  it('rejects unrelated car questions outside the Camino scope', () => {
    const result = service.shouldRedirectToPilgrimContext('quero alugar um carro para viajar para Porto');

    expect(result.redirect).toBe(true);
    expect(result.reply).toContain('Caminho de Santiago');
  });

  it('accepts Camino-specific pilgrimage questions', () => {
    const result = service.shouldRedirectToPilgrimContext('onde posso dormir perto da etapa de Sarria?');

    expect(result.redirect).toBe(false);
    expect(result.reply).toBeNull();
  });

  it('prefers the user language over the client locale when the user writes in Portuguese', () => {
    const session = (service as any).sessions.getOrCreate('lang-test', 'en');
    const result = (service as any).resolveLanguage(session, { language: 'en' }, 'qual é o melhor albergue perto da etapa de Sarria?');

    expect(result).toBe('pt');
  });

  it('keeps the Camino scope mode when the request explicitly says it is Camino-specific', () => {
    const result = service.shouldRedirectToPilgrimContext('qual é o melhor albergue na etapa de Sarria?', 'camino');

    expect(result.redirect).toBe(false);
    expect(result.reply).toBeNull();
  });
});
