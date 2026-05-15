import { Injectable } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import {
  ModerationDecision,
  ModerationResult,
  ModerationTarget,
} from './content-moderation.types';

type OpenAiModerationResponse = {
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
  }>;
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const IMAGE_TEXT_REJECT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(porn|nudes?|explicit\s*sex|sex\s*toy|xxx|erotic)\b/i,
    reason: 'Sexually explicit text detected inside the image.',
  },
  {
    pattern: /\b(rape|pedophile|pedofilia|csam|child\s*porn)\b/i,
    reason: 'Abusive or illegal text detected inside the image.',
  },
];

const COMMENT_REJECT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(csam|child\s*porn|child\s*sexual\s*abuse|loli)\b/i,
    reason: 'Possible child sexual exploitation content.',
  },
  {
    pattern: /\b(kill\s*yourself|suicide|bomb\s*the|make\s*a\s*bomb|terrorist)\b/i,
    reason: 'Threatening or violent content.',
  },
  {
    pattern: /\b(porn|nudes?|explicit\s*sex|rape|estupro|pedophile|pedofilia)\b/i,
    reason: 'Sexual explicit or abusive content.',
  },
  {
    pattern: /\b(nazi|heil\s*hitler|gas\s+the\s+jews|white\s*supremacy)\b/i,
    reason: 'Hate or extremist content.',
  },
];

const COMMENT_REVIEW_PATTERNS: Array<{ pattern: RegExp; signal: string }> = [
  { pattern: /(https?:\/\/|www\.)\S+/i, signal: 'contains_link' },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, signal: 'contains_email' },
  { pattern: /\b\+?\d[\d\s().-]{7,}\b/i, signal: 'contains_phone_number' },
  { pattern: /(.)\1{6,}/, signal: 'repeated_characters' },
];

@Injectable()
export class ContentModerationService {
  private readonly provider = (
    process.env.CONTENT_MODERATION_PROVIDER || 'local'
  )
    .trim()
    .toLowerCase();

  private readonly openAiApiKey = process.env.OPENAI_API_KEY?.trim() || '';

  private readonly openAiModel =
    process.env.CONTENT_MODERATION_MODEL?.trim() || 'gpt-4o-mini';

  private ocrWorkerPromise: Promise<any> | null = null;

  private get usesOpenAi(): boolean {
    return this.provider === 'openai' && !!this.openAiApiKey;
  }

  async moderateComment(text: string): Promise<ModerationResult> {
    const localDecision = this.moderateCommentLocally(text);

    if (localDecision.decision === 'reject' || !this.usesOpenAi) {
      return localDecision;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'omni-moderation-latest',
          input: text,
        }),
      });

      if (!response.ok) {
        return localDecision;
      }

      const payload = (await response.json()) as OpenAiModerationResponse;
      const flagged = payload.results?.[0]?.flagged ?? false;

      if (flagged) {
        const categories = payload.results?.[0]?.categories ?? {};
        const enabledCategories = Object.entries(categories)
          .filter(([, value]) => value)
          .map(([key]) => key);

        return {
          target: 'comment',
          provider: 'openai',
          decision: 'reject',
          reason:
            enabledCategories.length > 0
              ? `Blocked by AI moderation: ${enabledCategories.join(', ')}`
              : 'Blocked by AI moderation.',
          signals: enabledCategories,
        };
      }

      return {
        target: 'comment',
        provider: 'openai',
        decision: 'allow',
      };
    } catch {
      return localDecision;
    }
  }

  async moderateImageUrls(urls: string[]): Promise<ModerationResult> {
    const normalizedUrls = urls
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (normalizedUrls.length === 0) {
      return {
        target: 'image',
        provider: 'local',
        decision: 'allow',
      };
    }

    for (const url of normalizedUrls) {
      const ocrText = await this.tryExtractVisibleText(url);
      const ocrDecision = this.evaluateVisibleText(ocrText);

      if (ocrDecision) {
        return {
          target: 'image',
          provider: 'local',
          decision: 'reject',
          reason: ocrDecision.reason,
          signals: ocrDecision.signals,
          visibleText: ocrText || undefined,
        };
      }
    }

    if (!this.usesOpenAi) {
      return {
        target: 'image',
        provider: 'local',
        decision: 'review',
        reason:
          'Image moderation provider is not configured. Content will remain pending for manual review.',
      };
    }

    for (const url of normalizedUrls) {
      try {
        const verdict = await this.moderateImageUrlWithOpenAi(url);

        const visibleTextDecision = this.evaluateVisibleText(
          verdict.visibleText ?? '',
        );

        if (visibleTextDecision) {
          return {
            target: 'image',
            provider: 'openai',
            decision: 'reject',
            reason: visibleTextDecision.reason,
            confidence: verdict.confidence,
            signals: [...(verdict.signals ?? []), ...visibleTextDecision.signals],
            visibleText: verdict.visibleText,
          };
        }

        if (verdict.decision === 'reject') {
          return {
            target: 'image',
            provider: verdict.provider,
            decision: 'reject',
            reason:
              verdict.reason ||
              'Image blocked by content moderation.',
            confidence: verdict.confidence,
            signals: verdict.signals,
          };
        }
      } catch {
        return {
          target: 'image',
          provider: 'local',
          decision: 'review',
          reason:
            'Image moderation could not be completed. Content will remain pending for manual review.',
        };
      }
    }

    return {
      target: 'image',
      provider: 'openai',
      decision: 'allow',
    };
  }

  async moderateImageBuffers(buffers: Buffer[]): Promise<ModerationResult> {
    const normalizedBuffers = buffers.filter((buffer) => buffer && buffer.length > 0);

    if (normalizedBuffers.length === 0) {
      return {
        target: 'image',
        provider: 'local',
        decision: 'allow',
      };
    }

    for (const buffer of normalizedBuffers) {
      const ocrText = await this.tryExtractVisibleTextFromBuffer(buffer);
      const ocrDecision = this.evaluateVisibleText(ocrText);

      if (ocrDecision) {
        return {
          target: 'image',
          provider: 'local',
          decision: 'reject',
          reason: ocrDecision.reason,
          signals: ocrDecision.signals,
          visibleText: ocrText || undefined,
        };
      }
    }

    return {
      target: 'image',
      provider: 'local',
      decision: 'allow',
    };
  }

  private moderateCommentLocally(text: string): ModerationResult {
    const normalizedText = (text ?? '').trim();

    if (!normalizedText) {
      return {
        target: 'comment',
        provider: 'local',
        decision: 'allow',
      };
    }

    for (const entry of COMMENT_REJECT_PATTERNS) {
      if (entry.pattern.test(normalizedText)) {
        return {
          target: 'comment',
          provider: 'local',
          decision: 'reject',
          reason: entry.reason,
        };
      }
    }

    const reviewSignals = COMMENT_REVIEW_PATTERNS.flatMap((entry) =>
      entry.pattern.test(normalizedText) ? [entry.signal] : [],
    );

    const uppercaseRatio = this.getUppercaseRatio(normalizedText);
    if (uppercaseRatio >= 0.7 && normalizedText.length >= 20) {
      reviewSignals.push('excessive_caps');
    }

    if (reviewSignals.length > 0) {
      return {
        target: 'comment',
        provider: 'local',
        decision: 'review',
        reason: 'Comment contains spam-like or risky signals.',
        signals: reviewSignals,
      };
    }

    return {
      target: 'comment',
      provider: 'local',
      decision: 'allow',
    };
  }

  private async moderateImageUrlWithOpenAi(url: string): Promise<ModerationResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.openAiModel,
        temperature: 0,
        max_tokens: 250,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a strict content moderation classifier for images. Inspect the full image, including any visible text, screenshots, signs, posters, overlays, or watermarks. Return only JSON with keys decision, reason, confidence, signals, and visibleText. visibleText must contain any readable text found in the image, copied as faithfully as possible. decision must be allow, reject, or review. Reject if the image contains nudity, sexual content, explicit violence, hate symbols, threats, CSAM indicators, or illicit text such as porn, nude, sex, rape, pedophilia, or similar terms. Review if uncertain.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Moderate this image URL: ${url}. Check both the visual content and any readable text inside the image. Extract any readable text and include it in visibleText.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI moderation failed with ${response.status}`);
    }

    const payload = (await response.json()) as OpenAiChatResponse;
    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('OpenAI moderation returned an empty response');
    }

    const parsed = JSON.parse(content) as {
      decision?: ModerationDecision;
      reason?: string;
      confidence?: number;
      signals?: string[];
      visibleText?: string;
    };

    const visibleText = (parsed.visibleText ?? '').trim();
    for (const entry of IMAGE_TEXT_REJECT_PATTERNS) {
      if (entry.pattern.test(visibleText)) {
        return {
          target: 'image',
          provider: 'openai',
          decision: 'reject',
          reason: entry.reason,
          confidence: parsed.confidence,
          signals: [...(parsed.signals ?? []), 'visible_text_match'],
        };
      }
    }

    if (parsed.decision === 'reject') {
      return {
        target: 'image',
        provider: 'openai',
        decision: 'reject',
        reason: parsed.reason || 'Blocked by AI image moderation.',
        confidence: parsed.confidence,
        signals: parsed.signals,
      };
    }

    if (parsed.decision === 'review') {
      return {
        target: 'image',
        provider: 'openai',
        decision: 'review',
        reason: parsed.reason || 'Image requires manual review.',
        confidence: parsed.confidence,
        signals: parsed.signals,
      };
    }

    return {
      target: 'image',
      provider: 'openai',
      decision: 'allow',
      confidence: parsed.confidence,
      signals: parsed.signals,
      visibleText: parsed.visibleText,
    };
  }

  private async tryExtractVisibleText(url: string): Promise<string> {
    try {
      const worker = await this.getOcrWorker();
      const result = await worker.recognize(url);
      return (result?.data?.text ?? '').trim();
    } catch {
      return '';
    }
  }

  private async tryExtractVisibleTextFromBuffer(buffer: Buffer): Promise<string> {
    try {
      const worker = await this.getOcrWorker();
      const result = await worker.recognize(buffer);
      return (result?.data?.text ?? '').trim();
    } catch {
      return '';
    }
  }

  private async getOcrWorker(): Promise<any> {
    if (!this.ocrWorkerPromise) {
      this.ocrWorkerPromise = (async () => {
        const worker = await createWorker('eng');
        return worker;
      })();
    }

    return this.ocrWorkerPromise;
  }

  private evaluateVisibleText(
    text: string,
  ): { reason: string; signals: string[] } | null {
    const normalizedText = (text ?? '').trim();

    if (!normalizedText) {
      return null;
    }

    for (const entry of IMAGE_TEXT_REJECT_PATTERNS) {
      if (entry.pattern.test(normalizedText)) {
        return {
          reason: entry.reason,
          signals: ['visible_text_match'],
        };
      }
    }

    return null;
  }

  private getUppercaseRatio(text: string): number {
    const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (!letters.length) {
      return 0;
    }

    const uppercaseLetters = letters.replace(/[^A-ZÀ-Ý]/g, '');
    return uppercaseLetters.length / letters.length;
  }
}