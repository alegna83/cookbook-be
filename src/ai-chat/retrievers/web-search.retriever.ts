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

  private readonly genericAccommodationHosts = [
    'booking.com',
    'www.booking.com',
    'tripadvisor.com',
    'www.tripadvisor.com',
    'trivago.com',
    'www.trivago.com',
    'agoda.com',
    'www.agoda.com',
    'expedia.com',
    'www.expedia.com',
    'hostelworld.com',
    'www.hostelworld.com',
    'airbnb.com',
    'www.airbnb.com',
    'hotels.com',
    'www.hotels.com',
    'kayak.com',
    'www.kayak.com',
    'momondo.com',
    'www.momondo.com',
    'check-rates.com',
    'm.check-rates.com',
    'cheaphotels.com',
    'www.cheaphotels.com',
    'hotelscombined.com',
    'www.hotelscombined.com',
    'destinia.com',
    'www.destinia.com',
  ];

  readonly tool: ToolSpec = {
    name: 'search_web',
    description:
      'Search the public web for current travel information, recent pages, official accommodation sites and other information not guaranteed to exist in the app database. Use this when the user asks for up-to-date information, alternatives that may not be registered in the database, or a broader internet search.',
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
    const directResults = this.prioritizeDirectAccommodationResults(query, results).filter(
      (result) => !this.isGenericAccommodationComparisonPage(result),
    );

    return directResults.map((result, index) => ({
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
    // Without a region the engine answers from a global index, which is how a
    // search for Portuguese accommodation came back with Mimizan, France.
    endpoint.searchParams.set('kl', process.env.WEB_SEARCH_REGION?.trim() || 'pt-pt');

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

      if (this.isDuckDuckGoAd(rawUrl)) {
        continue;
      }

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

  private prioritizeDirectAccommodationResults(
    query: string,
    results: WebSearchResult[],
  ): WebSearchResult[] {
    if (!this.looksLikeAccommodationQuery(query)) {
      return results;
    }

    const direct = results.filter((result) => !this.isGenericAccommodationHost(result.url));

    // Previously this returned [] when every hit was a booking portal, which
    // is the normal case for accommodation queries — the assistant then had
    // nothing at all to work with. Demote them instead of discarding them.
    const generic = results.filter((result) => this.isGenericAccommodationHost(result.url));

    return [...direct, ...generic];
  }

  private looksLikeAccommodationQuery(query: string): boolean {
    return /\b(aloj|accommodation|accommodations|hotel|hostel|pensão|pensao|guesthouse|booking|reservation|reserve|stay|overnight)\b/i.test(
      query,
    );
  }

  private isGenericAccommodationHost(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return this.genericAccommodationHosts.some((genericHost) =>
        host === genericHost || host.endsWith(`.${genericHost}`),
      );
    } catch {
      return false;
    }
  }

  private isGenericAccommodationComparisonPage(result: WebSearchResult): boolean {
    const text = `${result.title} ${result.snippet ?? ''} ${result.url}`.toLowerCase();

    const blockedPatterns = [
      'compare hotel websites',
      'cheap accommodation',
      'accommodation deals in',
      'hundreds of',
      'resorts, motels',
      'b&bs, apartments',
      'destination-',
      '/destination-',
      'compare prices',
      'best price guarantee',
      'book the perfect',
    ];

    return blockedPatterns.some((pattern) => text.includes(pattern));
  }

  private isDuckDuckGoAd(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl, 'https://duckduckgo.com');
      return parsed.searchParams.has('ad_domain') || parsed.searchParams.has('ad_provider');
    } catch {
      return false;
    }
  }

  private cleanDuckDuckGoUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl, 'https://duckduckgo.com');
      const target =
        parsed.searchParams.get('uddg') ||
        parsed.searchParams.get('u') ||
        parsed.searchParams.get('u3');

      if (target) {
        const decoded = decodeURIComponent(target);
        if (/^https?:\/\//i.test(decoded)) {
          return decoded;
        }
      }

      if (/^https?:\/\//i.test(rawUrl)) {
        return rawUrl;
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