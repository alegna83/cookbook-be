import { Injectable } from '@nestjs/common';
import { UserChatContext } from './user-context';

export type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatSession = {
  id: string;
  /** Locked on the first message. Prevents the assistant from switching languages. */
  language: string;
  turns: ChatTurn[];
  /** Clarifying questions already asked, so the model never repeats them. */
  askedQuestions: string[];
  /** Last known app context (location, route, filters) for this conversation. */
  context: UserChatContext;
  lastSeenAt: number;
};

/** 6 user/assistant pairs is plenty for this use case and keeps token cost low. */
const MAX_TURNS = 12;
const MAX_QUESTIONS = 4;
const MAX_SESSIONS = 500;
const TTL_MS = 30 * 60 * 1000;

/**
 * Deliberately in-memory: it is bounded (~500 sessions) and cheap, which matters
 * on Render's small instances. Trade-off: history is lost on redeploy/restart.
 * If you need persistence, swap this class for Redis or a `chat_session` table
 * without touching AiChatService.
 */
@Injectable()
export class ChatSessionStore {
  private readonly sessions = new Map<string, ChatSession>();

  getOrCreate(id: string, language: string): ChatSession {
    const existing = this.sessions.get(id);

    if (existing && Date.now() - existing.lastSeenAt <= TTL_MS) {
      // Re-insert to keep Map iteration order = LRU order.
      this.sessions.delete(id);
      this.sessions.set(id, existing);
      existing.lastSeenAt = Date.now();
      return existing;
    }

    if (existing) {
      this.sessions.delete(id);
    }

    const session: ChatSession = {
      id,
      language,
      turns: [],
      askedQuestions: [],
      context: {},
      lastSeenAt: Date.now(),
    };

    this.sessions.set(id, session);
    this.evict();

    return session;
  }

  save(session: ChatSession): void {
    session.lastSeenAt = Date.now();

    if (session.turns.length > MAX_TURNS) {
      session.turns = session.turns.slice(-MAX_TURNS);
    }

    if (session.askedQuestions.length > MAX_QUESTIONS) {
      session.askedQuestions = session.askedQuestions.slice(-MAX_QUESTIONS);
    }

    this.sessions.set(session.id, session);
    this.evict();
  }

  private evict(): void {
    const now = Date.now();

    for (const [id, session] of this.sessions) {
      if (now - session.lastSeenAt > TTL_MS) {
        this.sessions.delete(id);
      }
    }

    while (this.sessions.size > MAX_SESSIONS) {
      const oldest = this.sessions.keys().next().value as string | undefined;
      if (!oldest) break;
      this.sessions.delete(oldest);
    }
  }
}