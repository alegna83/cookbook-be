import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AskChatDto } from './ask-chat.dto';
import { ChatSession, ChatSessionStore } from './chat-session.store';
import {
  KNOWLEDGE_RETRIEVERS,
  KnowledgeRetriever,
  RetrievalContext,
  RetrievedItem,
} from './knowledge-retriever';
import {
  describeUserContext,
  mergeUserContext,
  parseUserContext,
} from './user-context';

type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type AssistantMessage = {
  role: 'assistant';
  content: string | null;
  tool_calls?: ToolCall[];
};

type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | AssistantMessage
  | { role: 'tool'; tool_call_id: string; content: string };

export type ChatReply = {
  conversationId: string;
  answer: string;
  provider: 'openai' | 'huggingface';
  model: string;
  usedFallback: boolean;
  language: string;
  /** Domains actually queried, e.g. ['accommodations']. Useful for debugging. */
  usedTools: string[];
  /** Number of database records that backed the answer. 0 = generic answer. */
  groundedOn: number;
};

const LANGUAGE_NAMES: Record<string, string> = {
  pt: 'European Portuguese (pt-PT)',
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
};

const LANGUAGE_HINTS: Record<string, RegExp> = {
  pt: /\b(n[aã]o|sim|onde|estou|est[aá]|tenho|quero|preciso|obrigad[oa]|ol[aá]|alojamento|perto|melhor|tamb[eé]m|muito|voc[eê]|ficar|pr[oó]ximo|podes|uma|com|ajuda|caminho|d[uú]vida|encontres|etapa|pre[cç]o)\b/gi,
  es: /\b(s[ií]|d[oó]nde|estoy|tengo|quiero|necesito|gracias|hola|alojamiento|cerca|mejor|tambi[eé]n|muy|usted|quedarme|puedes|ayuda|camino|dudas|etapa|precio)\b/gi,
  fr: /\b(o[uù]|je|suis|veux|besoin|merci|bonjour|h[eé]bergement|proche|meilleur|aussi|tr[eè]s|vous|rester|pouvez|avec|aide|chemin|oui|[eé]tape|prix)\b/gi,
  de: /\b(wo|ich|bin|m[oö]chte|brauche|danke|hallo|unterkunft|nahe|beste|auch|sehr|bleiben|k[oö]nnen|eine|mit|hilfe|weg|ja|etappe|preis)\b/gi,
  it: /\b(dove|sono|voglio|bisogno|grazie|ciao|alloggio|vicino|migliore|anche|molto|restare|potete|aiuto|cammino|tappa|prezzo)\b/gi,
};

/** Two rounds is enough: search, optionally refine, then answer. */
const MAX_TOOL_ROUNDS = 2;
const MAX_ITEMS_PER_TOOL = 8;
const MAX_TOOL_PAYLOAD_CHARS = 4000;
const MAX_CONCRETE_RESULTS = 3;

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  private readonly timeoutMs = this.parsePositiveInt(
    process.env.AI_CHAT_TIMEOUT_MS,
    15000,
  );

  constructor(
    private readonly sessions: ChatSessionStore,
    @Inject(KNOWLEDGE_RETRIEVERS)
    private readonly retrievers: KnowledgeRetriever[],
  ) {}

  async ask(dto: AskChatDto): Promise<ChatReply> {
    const message = dto.message?.trim();

    if (!message) {
      throw new BadRequestException('message is required');
    }

    if (message.length > 1200) {
      throw new BadRequestException('message is too long');
    }

    const conversationId = dto.conversationId?.trim() || randomUUID();
    const session = this.sessions.getOrCreate(
      conversationId,
      dto.language || this.detectLanguage(message),
    );

    session.language = this.resolveLanguage(session, dto, message);
    session.context = mergeUserContext(
      session.context,
      parseUserContext(dto.context),
    );

    const messages = this.buildMessages(session, message);
    const retrievalContext: RetrievalContext = {
      userContext: session.context,
      language: session.language,
    };

    const result = await this.complete(messages, retrievalContext);
    const answer = this.sanitizeAnswer(result.answer, session.language);

    session.turns.push({ role: 'user', content: message });
    session.turns.push({ role: 'assistant', content: answer });

    if (answer.includes('?')) {
      session.askedQuestions.push(answer.slice(0, 200));
    }

    this.sessions.save(session);

    return {
      conversationId,
      answer,
      provider: result.provider,
      model: result.model,
      usedFallback: result.usedFallback,
      language: session.language,
      usedTools: result.usedTools,
      groundedOn: result.groundedOn,
    };
  }

  // ---------------------------------------------------------------- language

  private resolveLanguage(
    session: ChatSession,
    dto: AskChatDto,
    message: string,
  ): string {
    const detected = this.detectLanguage(message);

    if (detected !== 'en') {
      return detected;
    }

    if (dto.language) return dto.language;
    if (session.language) return session.language;
    return 'en';
  }

  private detectLanguage(text: string): string {
    const accentBonus: Record<string, RegExp> = {
      pt: /[ãõâêôçá]/gi,
      es: /[ñ¿¡]/gi,
      fr: /[èêëùûœæ]/gi,
      de: /[äöüß]/gi,
      it: /[àìòù]/gi,
    };

    let best = 'en';
    let bestScore = 0;

    for (const [lang, pattern] of Object.entries(LANGUAGE_HINTS)) {
      const words = (text.match(pattern) || []).length;
      const accents = (text.match(accentBonus[lang] ?? /$^/) || []).length;
      const score = words * 2 + accents;

      if (score > bestScore) {
        bestScore = score;
        best = lang;
      }
    }

    return bestScore > 0 ? best : 'en';
  }

  // ------------------------------------------------------------------ prompt

  private buildMessages(session: ChatSession, message: string): ChatMessage[] {
    const languageName = LANGUAGE_NAMES[session.language] || 'English';
    const toolList = this.retrievers
      .map((r) => `- ${r.tool.name}: ${r.tool.description}`)
      .join('\n');

    const system = `You are the Stays4Pilgrims Assistant, helping pilgrims walking the Caminho de Santiago. The product is a Flutter app with a NestJS backend, offering a map, accommodations, route stages, recorded prices, favourites, comments, suggestions and admin moderation. Some features require the user to be signed in, including the personalised "best accommodation" recommendation.

LANGUAGE
  - The language of this conversation is ${languageName}. Write EVERY answer in ${languageName} only.
  - Never mix languages in the same answer. If the user writes in another language or the tool output is in another language, translate it internally and still answer only in ${languageName}.
- Only change language if the user explicitly asks you to.

CONVERSATION RULES (the most important rules)
- The full conversation so far is given to you. Read it before answering. NEVER ask for something the user has already told you.
- Write the answer in the same language as the latest user message. If the latest message is Portuguese, answer in Portuguese. If it is English, answer in English. Switch language whenever the user switches language.
- A KNOWN CONTEXT block may already give you the user's location, route and filters. If it does, NEVER ask the user where they are. Say which area you are searching and answer.
- Ask AT MOST ONE clarifying question in the entire conversation, and only when you genuinely cannot act. Never ask two questions in a row, and never repeat a question you already asked.
- Short messages such as "sim", "yes", "estou em Viseu", "ok" are ANSWERS to your previous question. Treat them as such and give a substantive answer.
- If something is missing, make the most reasonable assumption, state it in one short sentence, and answer anyway.

TOOLS AND DATA
${toolList || '- (no tools available in this deployment)'}
- Call a tool whenever the question could be answered from the app's own data, as described in the tool list above.
- If the app database does not have enough information, use the web search tool before giving up.
- Prefer official pages, direct provider pages, accommodation listings and recent pages when using web search.
- Never tell the user to search, google, browse, or look it up themselves. You must do the search with tools if any tool can help.
- Never tell the user to go to tourism sites, tourism pages, or comparison portals to do the search themselves.
- If the first search is too narrow, automatically broaden it and try again before answering.
- Tool results may be in English; use them as facts only and do not copy their wording verbatim unless necessary.
- Never call the same tool twice with the same arguments.
- Only mention items returned by the tools. Never invent names, prices, distances, phone numbers or availability.
- If a tool returns no records, first try a broader search or the web search tool. If there is still nothing useful, say: "I couldn't confirm an exact match for that filter." Then give one short practical next step.
- For accommodation, route, and service searches, lead with the answer first. If results exist, start with one short sentence like "Encontrei estas opções:" and then show at most 3 bullets.
- For accommodation results, include the accommodation name and, when available, put the official site or reservation URL on its own line directly under the bullet so it is easy to copy.
- For accommodation questions, prefer direct accommodation pages or the app database. Do not answer with generic booking/comparison portals when a direct result exists.
- Never explain your search process unless the user asks how you found the answer.
- Questions that need no database lookup (how the credential works, what to pack, general Caminho advice) should be answered directly, without calling tools.

STYLE
- Maximum ~100 words for normal answers, ~140 words when listing search results.
- No preamble, no apologies, no meta talk about limitations unless no result was found.
- When listing results, use at most 3 short bullets: name — one concrete reason.
- Prefer short, direct sentences. If you found useful matches, do not end with "search the web" or "check online".`;

    const messages: ChatMessage[] = [{ role: 'system', content: system }];

    for (const turn of session.turns) {
      messages.push({ role: turn.role, content: turn.content } as ChatMessage);
    }

    messages.push({ role: 'user', content: this.buildUserContent(session, message) });

    return messages;
  }

  private buildUserContent(session: ChatSession, message: string): string {
    const parts: string[] = [];
    const contextLines = describeUserContext(session.context);

    if (contextLines.length > 0) {
      parts.push(
        'KNOWN CONTEXT (the app already provided this — NEVER ask the user for any of it):',
      );
      parts.push(contextLines.join('\n'));
    } else {
      parts.push(
        "KNOWN CONTEXT: none. The app could not determine the user's location, so ask which town they are in only if the question actually requires it.",
      );
    }

    parts.push('');

    if (session.askedQuestions.length > 0) {
      parts.push(
        'QUESTIONS YOU ALREADY ASKED (do not ask these or anything similar again):',
      );
      parts.push(session.askedQuestions.map((q) => `- ${q}`).join('\n'));
      parts.push('');
    }

    parts.push('USER MESSAGE:');
    parts.push(message);

    return parts.join('\n');
  }

  // --------------------------------------------------------------- providers

  private async complete(
    messages: ChatMessage[],
    retrievalContext: RetrievalContext,
  ): Promise<{
    answer: string;
    provider: 'openai' | 'huggingface';
    model: string;
    usedFallback: boolean;
    usedTools: string[];
    groundedOn: number;
  }> {
    const primaryKey =
      process.env.OPENAI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();

    let primaryError: unknown = new Error(
      'OPENAI_API_KEY or OPENROUTER_API_KEY is required',
    );

    if (primaryKey) {
      const usesOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
      const baseUrl = (
        process.env.OPENAI_BASE_URL ||
        (usesOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1')
      ).replace(/\/$/, '');
      const model =
        process.env.OPENAI_CHAT_MODEL?.trim() ||
        (usesOpenRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');

      try {
        const run = await this.runToolLoop(
          baseUrl,
          primaryKey,
          model,
          messages,
          retrievalContext,
          (() => {
            for (let index = messages.length - 1; index >= 0; index--) {
              const item = messages[index];
              if (item.role === 'user') {
                return item.content;
              }
            }
            return '';
          })(),
        );
        return { ...run, provider: 'openai', model, usedFallback: false };
      } catch (error) {
        primaryError = error;
        this.logger.warn(`Primary provider failed: ${this.stringifyError(error)}`);
      }
    }

    const hfToken = process.env.HUGGINGFACE_API_TOKEN?.trim();

    if (!hfToken) {
      throw new InternalServerErrorException(
        `AI request failed and no fallback provider is configured. ${this.stringifyError(primaryError)}`,
      );
    }

    // Tool support varies across Hugging Face inference providers, so the
    // fallback answers without tools. It degrades to generic guidance rather
    // than failing outright.
    const hfModel =
      process.env.HUGGINGFACE_CHAT_MODEL?.trim() ||
      'meta-llama/Llama-3.1-8B-Instruct';

    try {
      const assistant = await this.callChatCompletions(
        'https://router.huggingface.co/v1',
        hfToken,
        hfModel,
        messages,
      );
      const answer = assistant.content?.trim();

      if (!answer) throw new Error('Fallback response did not include an answer');

      return {
        answer,
        provider: 'huggingface',
        model: hfModel,
        usedFallback: true,
        usedTools: [],
        groundedOn: 0,
      };
    } catch (fallbackError) {
      throw new InternalServerErrorException(
        `AI request failed on both providers. Primary: ${this.stringifyError(primaryError)} | Fallback: ${this.stringifyError(fallbackError)}`,
      );
    }
  }

  /**
   * Ask the model; if it requests tools, run them, feed the results back and
   * ask again. On the final round tools are withheld, which forces an answer
   * and guarantees the loop terminates.
   */
  private async runToolLoop(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    retrievalContext: RetrievalContext,
    userMessage: string,
  ): Promise<{ answer: string; usedTools: string[]; groundedOn: number }> {
    const tools = this.retrievers.map((retriever) => ({
      type: 'function' as const,
      function: retriever.tool,
    }));

    const working = [...messages];
    const usedTools: string[] = [];
    let groundedOn = 0;
    const itemsByDomain = new Map<string, RetrievedItem[]>();

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const offerTools = tools.length > 0 && round < MAX_TOOL_ROUNDS;

      const assistant = await this.callChatCompletions(
        baseUrl,
        apiKey,
        model,
        working,
        offerTools ? tools : undefined,
      );

      if (!assistant.tool_calls?.length) {
        const answer = assistant.content?.trim();
        if (!answer) throw new Error('Model returned an empty answer');
        return { answer, usedTools, groundedOn };
      }

      working.push(assistant);

      const results = await Promise.all(
        assistant.tool_calls.map((call) =>
          this.executeToolCall(call, retrievalContext),
        ),
      );

      for (const result of results) {
        groundedOn += result.count;
        if (result.domain) usedTools.push(result.domain);
        if (result.domain && result.items.length > 0) {
          const existing = itemsByDomain.get(result.domain) ?? [];
          itemsByDomain.set(result.domain, [...existing, ...result.items]);
        }
        working.push(result.message);
      }

      const aggregatedItems: RetrievedItem[] = [];
      for (const domainItems of itemsByDomain.values()) {
        aggregatedItems.push(...domainItems);
      }

      const concreteAnswer = this.buildConcreteToolAnswer(
        aggregatedItems,
        retrievalContext.language,
      );

      if (concreteAnswer) {
        return {
          answer: concreteAnswer,
          usedTools,
          groundedOn,
        };
      }

      if (this.isAccommodationRequest(userMessage) && round === MAX_TOOL_ROUNDS) {
        return {
          answer: this.noResultsWebFallback(retrievalContext.language),
          usedTools,
          groundedOn,
        };
      }

      if (groundedOn === 0) {
        const webFallback = await this.tryWebFallback(
          baseUrl,
          apiKey,
          model,
          working,
          retrievalContext,
          userMessage,
          usedTools,
        );

        if (webFallback) {
          return webFallback;
        }
      }
    }

    throw new Error('Tool loop did not converge');
  }

  private async tryWebFallback(
    baseUrl: string,
    apiKey: string,
    model: string,
    working: ChatMessage[],
    retrievalContext: RetrievalContext,
    userMessage: string,
    usedTools: string[],
  ): Promise<{ answer: string; usedTools: string[]; groundedOn: number } | null> {
    if (usedTools.includes('web')) {
      return null;
    }

    const webRetriever = this.retrievers.find((retriever) => retriever.domain === 'web');
    if (!webRetriever) {
      return null;
    }

    const searchQuery = await this.buildWebSearchQuery(
      baseUrl,
      apiKey,
      model,
      userMessage,
      retrievalContext,
    );

    const query = searchQuery || this.buildHeuristicWebQuery(userMessage, retrievalContext);
    if (!query) {
      return null;
    }

    const queryVariants = [
      query,
      this.buildBroaderWebQuery(query),
      this.buildBroaderWebQuery(userMessage),
    ].filter((value, index, all) => value && all.indexOf(value) === index) as string[];

    let items: RetrievedItem[] = [];

    for (const variant of queryVariants) {
      items = await webRetriever.search({ query: variant, limit: 5 }, retrievalContext);
      if (items.length > 0) {
        break;
      }
    }

    if (items.length === 0) {
      return null;
    }

    const concreteWebAnswer = this.buildConcreteToolAnswer(
      items,
      retrievalContext.language,
    );

    if (concreteWebAnswer) {
      return {
        answer: concreteWebAnswer,
        usedTools: [...usedTools, 'web'],
        groundedOn: items.length,
      };
    }

    return {
      answer: this.noResultsWebFallback(retrievalContext.language),
      usedTools: [...usedTools, 'web'],
      groundedOn: items.length,
    };
  }

  private async buildWebSearchQuery(
    baseUrl: string,
    apiKey: string,
    model: string,
    userMessage: string,
    retrievalContext: RetrievalContext,
  ): Promise<string | null> {
    try {
      const assistant = await this.callChatCompletions(
        baseUrl,
        apiKey,
        model,
        [
          {
            role: 'system',
            content:
              'Rewrite the user request into one short web search query in the same language as the request. Include location, service, and useful synonyms. Return only the query text, no bullet points, no quotes.',
          },
          {
            role: 'user',
            content: [
              `User message: ${userMessage}`,
              retrievalContext.userContext.locality ? `Known locality: ${retrievalContext.userContext.locality}` : '',
              retrievalContext.userContext.route ? `Known route: ${retrievalContext.userContext.route}` : '',
              retrievalContext.userContext.stage ? `Known stage: ${retrievalContext.userContext.stage}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        undefined,
        120,
      );

      const query = assistant.content?.trim().replace(/^['"`]+|['"`]+$/g, '');
      return query || null;
    } catch (error) {
      this.logger.warn(`Web query planner failed: ${this.stringifyError(error)}`);
      return null;
    }
  }

  private buildHeuristicWebQuery(
    userMessage: string,
    retrievalContext: RetrievalContext,
  ): string | null {
    const parts = [
      retrievalContext.userContext.locality,
      retrievalContext.userContext.route,
      retrievalContext.userContext.stage,
      userMessage,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    return parts ? parts.slice(0, 200) : null;
  }

  private buildBroaderWebQuery(query: string): string {
    return query
      .replace(/\b(zona histórica|centro histórico|old town|historic area)\b/gi, 'center')
      .replace(/\b(alojamentos?|accommodations?|hostels?|hoteis?|hotéis?)\b/gi, 'accommodation')
      .replace(/\b(cozinha|kitchen|cuisine)\b/gi, 'kitchen')
      .replace(/\b(perto de|near|nearby)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
  }

  private async executeToolCall(
    call: ToolCall,
    retrievalContext: RetrievalContext,
  ): Promise<{
    count: number;
    domain?: string;
    items: RetrievedItem[];
    message: { role: 'tool'; tool_call_id: string; content: string };
  }> {
    const retriever = this.retrievers.find((r) => r.tool.name === call.function.name);

    const respond = (
      payload: unknown,
      count = 0,
      domain?: string,
      items: RetrievedItem[] = [],
    ) => ({
      count,
      domain,
      items,
      message: {
        role: 'tool' as const,
        tool_call_id: call.id,
        content: JSON.stringify(payload).slice(0, MAX_TOOL_PAYLOAD_CHARS),
      },
    });

    if (!retriever) {
      return respond({ error: `Unknown tool: ${call.function.name}` });
    }

    try {
      const args = call.function.arguments
        ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
        : {};

      const items = (await retriever.search(args, retrievalContext)).slice(
        0,
        MAX_ITEMS_PER_TOOL,
      );

      this.logger.log(
        `tool=${retriever.tool.name} args=${call.function.arguments} results=${items.length}`,
      );

      return respond(
        { count: items.length, items },
        items.length,
        retriever.domain,
        items,
      );
    } catch (error) {
      // A broken retriever must not break the chat: report it to the model,
      // which then answers without that data.
      this.logger.warn(
        `Tool ${call.function.name} failed: ${this.stringifyError(error)}`,
      );
      return respond({ error: 'This data source is temporarily unavailable.' });
    }
  }

  private async callChatCompletions(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    tools?: Array<{ type: 'function'; function: unknown }>,
    maxTokens = 500,
  ): Promise<AssistantMessage> {
    const response = await this.fetchWithTimeout(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages,
        ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Request to ${baseUrl} failed with status ${response.status}: ${body.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: AssistantMessage }>;
    };

    const message = data.choices?.[0]?.message;

    if (!message) {
      throw new Error(`Response from ${baseUrl} did not include a message`);
    }

    return message;
  }

  // ----------------------------------------------------------------- helpers

  private parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private stringifyError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private sanitizeAnswer(answer: string, language: string): string {
    const trimmed = answer.trim();

    if (!trimmed) {
      return trimmed;
    }

    // Keep line structure intact so URLs are never split (e.g. "https://www...").
    const lines = trimmed.split('\n');
    const filtered = lines.filter((line) => !this.containsUserSearchDirective(line));

    const cleaned = filtered
      .join('\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (cleaned) {
      return cleaned;
    }

    return this.noSearchFallback(language);
  }

  private containsUserSearchDirective(text: string): boolean {
    const patterns = [
      /\b(?:podes|pode|vai|vais|tenta|tente|precisas|precisa)\b[^\n]*\b(?:pesquis|procur|google|search|look up|browse)\b/i,
      /\b(?:pesquis|procur|google|search|look up|browse)\b[^\n]*\b(?:tu|você|you)\b/i,
      /\b(?:search the web|look it up|browse the web)\b/i,
      /\b(?:tourism|turismo)\b[^\n]*(?:site|sites|page|pages|portal|portals|website|websites)/i,
      /\b(?:visit|visita|consulte|consulta|check|see)\b[^\n]*(?:tourism|turismo)\b/i,
      /\b(?:plataformas?|platforms?)\s+(?:de\s+)?reservas?\b/i,
      /\b(?:pergunte|ask)\b[^\n]*(?:a\s+)?(?:locais|locals|people|pessoas|other pilgrims|outros peregrinos)\b/i,
    ];

    return patterns.some((pattern) => pattern.test(text));
  }

  private isAccommodationRequest(text: string): boolean {
    return /\b(alojamento|alojamentos|acomodacao|acomodações|accommodations?|hotel|hostel|guesthouse|pensão|pensao)\b/i.test(
      text,
    );
  }

  private noSearchFallback(language: string): string {
    switch (language) {
      case 'pt':
        return 'Não consegui confirmar opções melhores com estes critérios.';
      case 'es':
        return 'No pude confirmar mejores opciones con estos criterios.';
      case 'fr':
        return 'Je n\'ai pas pu confirmer de meilleures options avec ces critères.';
      case 'de':
        return 'Ich konnte mit diesen Kriterien keine besseren Optionen bestätigen.';
      case 'it':
        return 'Non sono riuscito a confermare opzioni migliori con questi criteri.';
      default:
        return 'I could not confirm better options with these criteria.';
    }
  }

  private noResultsWebFallback(language: string): string {
    switch (language) {
      case 'pt':
        return 'Ainda não consegui confirmar dados concretos para isso agora. Posso afinar por vila, etapa ou serviço.';
      case 'es':
        return 'Aún no pude confirmar datos concretos para eso ahora. Puedo afinar por villa, etapa o servicio.';
      case 'fr':
        return 'Je n\'ai pas encore pu confirmer de données concrètes pour cela. Je peux affiner par ville, étape ou service.';
      case 'de':
        return 'Ich konnte dazu noch keine konkreten Daten bestätigen. Ich kann nach Ort, Etappe oder Service präzisieren.';
      case 'it':
        return 'Non sono ancora riuscito a confermare dati concreti per questo. Posso affinare per paese, tappa o servizio.';
      default:
        return 'I could not confirm concrete data for that right now. I can narrow it by town, stage, or service.';
    }
  }

  private buildConcreteToolAnswer(
    items: RetrievedItem[],
    language: string,
  ): string | null {
    const selected = this.uniqueConcreteItems(items).slice(0, MAX_CONCRETE_RESULTS);

    if (selected.length === 0) {
      return null;
    }

    const intro = this.concreteIntro(language);
    const lines = [intro];

    for (const item of selected) {
      const reason = this.buildConcreteReason(item, language);
      lines.push(`- ${item.title}${reason ? ` - ${reason}` : ''}`);

      const bestUrl = this.bestItemUrl(item);

      if (bestUrl) {
        lines.push(`  ${this.linkLabel(language)}: ${bestUrl}`);
      }
    }

    return lines.join('\n');
  }

  private uniqueConcreteItems(items: RetrievedItem[]): RetrievedItem[] {
    const seen = new Set<string>();
    const unique: RetrievedItem[] = [];

    for (const item of items) {
      const key = `${item.kind}:${String(item.id)}:${item.title}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(item);
    }

    return unique;
  }

  private bestItemUrl(item: RetrievedItem): string | undefined {
    const reservationUrl =
      typeof item.extra?.reservationUrl === 'string'
        ? item.extra.reservationUrl
        : undefined;

    return reservationUrl || item.url || undefined;
  }

  private buildConcreteReason(item: RetrievedItem, language: string): string {
    const parts = item.summary
      .split('·')
      .map((part) => part.trim())
      .filter(Boolean);

    const preferred = parts.find((part) =>
      /from\s+\d+|rated|km|services|open:|days|difficulty|distance|price|etapa|stage|camino/i.test(part),
    );
    if (preferred) {
      return preferred;
    }

    if (parts.length > 0) {
      return parts[0];
    }

    if (item.kind === 'web') {
      switch (language) {
        case 'pt':
          return 'fonte recente encontrada';
        case 'es':
          return 'fuente reciente encontrada';
        case 'fr':
          return 'source récente trouvée';
        case 'de':
          return 'aktuelle Quelle gefunden';
        case 'it':
          return 'fonte recente trovata';
        default:
          return 'recent source found';
      }
    }

    switch (language) {
      case 'pt':
        return 'resultado disponível na base de dados';
      case 'es':
        return 'resultado disponible en la base de datos';
      case 'fr':
        return 'résultat disponible dans la base de données';
      case 'de':
        return 'Ergebnis in der Datenbank verfügbar';
      case 'it':
        return 'risultato disponibile nel database';
      default:
        return 'result available in the app database';
    }
  }

  private concreteIntro(language: string): string {
    switch (language) {
      case 'pt':
        return 'Encontrei estes resultados concretos:';
      case 'es':
        return 'Encontré estos resultados concretos:';
      case 'fr':
        return 'J\'ai trouvé ces résultats concrets :';
      case 'de':
        return 'Ich habe diese konkreten Ergebnisse gefunden:';
      case 'it':
        return 'Ho trovato questi risultati concreti:';
      default:
        return 'I found these concrete results:';
    }
  }

  private linkLabel(language: string): string {
    switch (language) {
      case 'pt':
        return 'Link direto';
      case 'es':
        return 'Enlace directo';
      case 'fr':
        return 'Lien direct';
      case 'de':
        return 'Direktlink';
      case 'it':
        return 'Link diretto';
      default:
        return 'Direct link';
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
}