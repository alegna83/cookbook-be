import { UserChatContext } from './user-context';

export const KNOWLEDGE_RETRIEVERS = 'KNOWLEDGE_RETRIEVERS';

/** A single result, whatever the domain it came from. */
export type RetrievedItem = {
  kind: 'accommodation' | 'stage' | 'place-price' | 'camino' | 'web';
  id: string | number;
  /** Short label the assistant can show to the user. */
  title: string;
  /** One or two sentences of substance. Keep it dense — it costs tokens. */
  summary: string;
  locality?: string;
  distanceKm?: number;
  url?: string;
  /** Domain-specific fields (price, duration, difficulty...). */
  extra?: Record<string, unknown>;
};

/** OpenAI-compatible function description. */
export type ToolSpec = {
  /** snake_case, unique across retrievers. */
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  parameters: Record<string, unknown>;
};

export type RetrievalContext = {
  userContext: UserChatContext;
  language: string;
};

/**
 * One implementation per domain. The model decides which ones to call and with
 * what arguments, so adding a domain means writing a class and registering it —
 * AiChatService never changes.
 */
export interface KnowledgeRetriever {
  readonly domain: string;
  readonly tool: ToolSpec;
  search(
    args: Record<string, unknown>,
    context: RetrievalContext,
  ): Promise<RetrievedItem[]>;
}

/** Helpers shared by the retrievers. */
export function asOptionalString(value: unknown, max = 80): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export function asOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}