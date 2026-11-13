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
});
