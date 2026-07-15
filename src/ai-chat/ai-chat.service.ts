import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { AskChatDto } from './ask-chat.dto';

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatReply = {
  answer: string;
  provider: 'openai' | 'huggingface';
  model: string;
  usedFallback: boolean;
};

@Injectable()
export class AiChatService {
  private readonly timeoutMs = this.parsePositiveInt(
    process.env.AI_CHAT_TIMEOUT_MS,
    12000,
  );

  async ask(dto: AskChatDto): Promise<ChatReply> {
    const message = dto.message?.trim();

    if (!message) {
      throw new BadRequestException('message is required');
    }

    if (message.length > 1200) {
      throw new BadRequestException('message is too long');
    }

    const userPrompt = this.buildUserPrompt(message, dto.context);

    try {
      const primary = await this.askOpenAi(userPrompt);
      return {
        answer: primary.answer,
        provider: 'openai',
        model: primary.model,
        usedFallback: false,
      };
    } catch (primaryError) {
      const hfToken = process.env.HUGGINGFACE_API_TOKEN?.trim();

      if (!hfToken) {
        throw new InternalServerErrorException(
          'Primary AI provider failed and no fallback provider is configured.',
        );
      }

      try {
        const fallback = await this.askHuggingFace(userPrompt, hfToken);
        return {
          answer: fallback.answer,
          provider: 'huggingface',
          model: fallback.model,
          usedFallback: true,
        };
      } catch (fallbackError) {
        throw new InternalServerErrorException(
          `AI request failed on both providers. Primary: ${this.stringifyError(primaryError)} | Fallback: ${this.stringifyError(fallbackError)}`,
        );
      }
    }
  }

  private async askOpenAi(
    userPrompt: string,
  ): Promise<{ answer: string; model: string }> {
    const apiKey =
      process.env.OPENAI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY or OPENROUTER_API_KEY is required');
    }

    const configuredModel = process.env.OPENAI_CHAT_MODEL?.trim();
    const model =
      configuredModel ||
      (process.env.OPENROUTER_API_KEY?.trim() ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');

    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(
      /\/$/,
      '',
    );

    const response = await this.fetchJsonWithTimeout(
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 500,
          messages: this.buildMessages(userPrompt),
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenAI request failed with status ${response.status}: ${body.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const answer = data.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error('OpenAI response did not include a valid answer');
    }

    return { answer, model };
  }

  private async askHuggingFace(
    userPrompt: string,
    token: string,
  ): Promise<{ answer: string; model: string }> {
    const model =
      process.env.HUGGINGFACE_CHAT_MODEL?.trim() ||
      'mistralai/Mistral-7B-Instruct-v0.3';

    const response = await this.fetchJsonWithTimeout(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: userPrompt,
          parameters: {
            max_new_tokens: 300,
            temperature: 0.3,
            return_full_text: false,
          },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Hugging Face request failed with status ${response.status}: ${body.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as
      | Array<{ generated_text?: string }>
      | { generated_text?: string; error?: string };

    let answer = '';

    if (Array.isArray(data)) {
      answer = data[0]?.generated_text?.trim() || '';
    } else {
      if (data.error) {
        throw new Error(`Hugging Face error: ${data.error}`);
      }
      answer = data.generated_text?.trim() || '';
    }

    if (!answer) {
      throw new Error('Hugging Face response did not include a valid answer');
    }

    return { answer, model };
  }

  private buildMessages(userPrompt: string): OpenAiMessage[] {
    return [
      {
        role: 'system',
        content:
          'You are Stays4Pilgrims Assistant. Give concise, practical answers about pilgrim accommodations. Prefer data-grounded suggestions, mention uncertainty when needed, and avoid inventing unavailable details.',
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];
  }

  private buildUserPrompt(
    message: string,
    context?: Record<string, unknown>,
  ): string {
    const safeContext = context ? JSON.stringify(context).slice(0, 4000) : '{}';

    return [
      'User message:',
      message,
      '',
      'Context JSON:',
      safeContext,
      '',
      'Respond in the user language. If context is missing, ask one focused follow-up question.',
    ].join('\n');
  }

  private parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private async fetchJsonWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
