import { Injectable } from '@nestjs/common';
import {
  KnowledgeRetriever,
  RetrievalContext,
  RetrievedItem,
  ToolSpec,
  asOptionalString,
} from '../knowledge-retriever';

export type WebSearchResult = {
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: string;
};

@Injectable()
export class WebSearchRetriever implements KnowledgeRetriever {
  readonly domain = 'web';

  readonly tool: ToolSpec = {
    name: 'search_web',
    description:
      'Search the public web for current travel information, recent pages, official accommodation sites, tourism pages and other information not guaranteed to exist in the app database. Use this when the user asks for up-to-date information, alternatives that may not be registered in the database, or a broader internet search.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'What to search for on the web. Include the town, service or question, e.g. "alojamentos zona histórica de Viseu cozinha".',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of web results to return. Defaults to 5.',
        },
      },
      required: ['query'],
    },
  };

  async search(args: Record<string, unknown>, _ctx: RetrievalContext): Promise<RetrievedItem[]> {
    const query = asOptionalString(args.query, 200);
    if (!query) {
      return [];
    }

    const limit = Math.min(Math.max(Number(args.limit ?? 5) || 5, 1), 8);
    const results = await this.searchDuckDuckGo(query, limit);

    return results.map((result, index) => ({
      kind: 'web',
      id: `${index}-${result.url}`,
      title: result.title,
      summary: result.snippet || 'Web result',
      url: result.url,
      extra: result.publishedAt ? { publishedAt: result.publishedAt } : undefined,
    }));
  }

  private async searchDuckDuckGo(query: string, limit: number): Promise<WebSearchResult[]> {
    const endpoint = new URL('https://html.duckduckgo.com/html/');
    endpoint.searchParams.set('q', query);

    const response = await fetch(endpoint, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const results: WebSearchResult[] = [];
    const itemRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const match of html.matchAll(itemRegex)) {
      const rawUrl = match[1];
      const titleHtml = match[2];
      const snippetHtml = match[3];
      const url = this.cleanDuckDuckGoUrl(rawUrl);
      const title = this.stripHtml(titleHtml);
      const snippet = this.stripHtml(snippetHtml);

      if (!url || !title) {
        continue;
      }

      results.push({ title, url, snippet });
      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }

  private cleanDuckDuckGoUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl, 'https://duckduckgo.com');
      const target = parsed.searchParams.get('uddg');
      if (target) {
        return decodeURIComponent(target);
      }
      return rawUrl;
    } catch {
      return rawUrl;
    }
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
