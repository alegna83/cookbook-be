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

  it('switches the reply language to Portuguese even when the existing session language is English', () => {
    const session = (service as any).sessions.getOrCreate('lang-switch-test', 'en');
    session.turns.push({ role: 'user', content: 'Where is the best hostel?' });
    session.turns.push({ role: 'assistant', content: 'I can help with Camino lodging.' });

    const result = (service as any).resolveLanguage(session, { language: 'en' }, 'qual é o melhor albergue perto da etapa de Sarria?');

    expect(result).toBe('pt');
  });

  it('keeps the Camino scope mode when the request explicitly says it is Camino-specific', () => {
    const result = service.shouldRedirectToPilgrimContext('qual é o melhor albergue na etapa de Sarria?', 'camino');

    expect(result.redirect).toBe(false);
    expect(result.reply).toBeNull();
  });

  it('allows web search in general mode when the user asks for concrete travel information', () => {
    const session = (service as any).sessions.getOrCreate('general-scope-test', 'pt');
    const messages = (service as any).buildMessages(session, 'qual é o melhor restaurante em Lisboa?', 'general');
    const systemPrompt = messages.find((m: any) => m.role === 'system')?.content ?? '';

    expect(systemPrompt).toContain('Current chat scope: general travel');
    expect(systemPrompt).toContain('use search_web whenever it can improve the answer');
  });

  it('treats nearby pastry-shop queries as local discovery questions that should search the web', () => {
    const session = (service as any).sessions.getOrCreate('nearby-pastelarias-test', 'pt');
    const messages = (service as any).buildMessages(session, 'quais pastelarias há perto de mim?', 'general');
    const systemPrompt = messages.find((m: any) => m.role === 'system')?.content ?? '';

    expect(systemPrompt).toContain('pastelarias perto de mim');
    expect(systemPrompt).toContain('Search nearby places and the web');
  });

  it('allows web search in Camino mode for useful practical facts near the route', () => {
    const session = (service as any).sessions.getOrCreate('camino-scope-test', 'pt');
    const messages = (service as any).buildMessages(session, 'há transporte público para a próxima etapa?', 'camino');
    const systemPrompt = messages.find((m: any) => m.role === 'system')?.content ?? '';

    expect(systemPrompt).toContain('Current chat scope: camino');
    expect(systemPrompt).toContain('use search_web when it adds concrete');
  });
});
