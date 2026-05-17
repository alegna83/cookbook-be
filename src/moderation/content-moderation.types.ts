export type ModerationDecision = 'allow' | 'reject' | 'review';

export type ModerationTarget = 'comment' | 'image';

export interface ModerationResult {
  target: ModerationTarget;
  decision: ModerationDecision;
  provider: 'local' | 'openai';
  reason?: string;
  confidence?: number;
  signals?: string[];
  visibleText?: string;
}