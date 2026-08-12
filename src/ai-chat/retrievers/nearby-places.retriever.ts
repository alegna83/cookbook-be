import { Injectable, Logger } from '@nestjs/common';
import {
  KnowledgeRetriever,
  RetrievalContext,
  RetrievedItem,
  ToolSpec,
  asOptionalNumber,
  asOptionalString,
} from '../knowledge-retriever';

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * OSM tag filters per category. Kept small on purpose: a broad query against
 * the public Overpass instance is slow and abuses a free community service.
 */
const CATEGORY_FILTERS: Record<string, string[]> = {
  food: ['"amenity"~"^(restaurant|cafe|fast_food|bar|pub)$"'],
  groceries: ['"shop"~"^(supermarket|convenience|bakery|greengrocer)$"'],
  pharmacy: ['"amenity"="pharmacy"'],
  health: ['"amenity"~"^(pharmacy|hospital|clinic|doctors)$"'],
  money: ['"amenity"~"^(atm|bank|bureau_de_change)$"'],
  laundry: ['"shop"="laundry"', '"amenity"="laundry"'],
  sights: [
    '"tourism"~"^(attraction|museum|viewpoint|artwork|gallery)$"',
    '"historic"~"^(church|monastery|castle|monument|ruins|wayside_cross)$"',
  ],
  water: ['"amenity"~"^(drinking_water|water_point|fountain)$"'],
  transport: ['"amenity"="bus_station"', '"railway"="station"', '"highway"="bus_stop"'],
};

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: 'restaurant',
  cafe: 'café',
  fast_food: 'fast food',
  bar: 'bar',
  pub: 'pub',
  supermarket: 'supermarket',
  convenience: 'convenience store',
  bakery: 'bakery',
  pharmacy: 'pharmacy',
  drinking_water: 'drinking water',
};

@Injectable()
export class NearbyPlacesRetriever implements KnowledgeRetriever {
  private readonly logger = new Logger(NearbyPlacesRetriever.name);

  /** Small cache: pilgrims in the same town produce the same query. */
  private readonly cache = new Map<string, { at: number; items: RetrievedItem[] }>();
  private readonly cacheTtlMs = 15 * 60 * 1000;

  readonly domain = 'nearby-places';

  readonly tool: ToolSpec = {
    name: 'search_nearby_places',
    description:
      'Find real places around a point using OpenStreetMap: restaurants, cafés, supermarkets, pharmacies, ATMs, laundries, drinking water, transport and things to see. Use this for questions like "where can I have dinner", "what is worth visiting here", "where do I buy food", "is there a pharmacy nearby". This is the right tool for anything that is a physical place near the user but is NOT an accommodation registered in the app.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: Object.keys(CATEGORY_FILTERS),
          description:
            'What kind of place to look for. Use "food" for eating out, "sights" for things to visit.',
        },
        radiusKm: {
          type: 'number',
          description: 'Search radius in km, 0.5 to 10. Defaults to 2.',
        },
        lat: {
          type: 'number',
          description: 'Latitude. Omit to use the user\'s known location.',
        },
        lng: {
          type: 'number',
          description: 'Longitude. Omit to use the user\'s known location.',
        },
      },
      required: ['category'],
    },
  };

  async search(
    args: Record<string, unknown>,
    { userContext }: RetrievalContext,
  ): Promise<RetrievedItem[]> {
    const category = asOptionalString(args.category, 20)?.toLowerCase() ?? 'food';
    const filters = CATEGORY_FILTERS[category];

    if (!filters) {
      return [];
    }

    const lat = asOptionalNumber(args.lat) ?? userContext.userLocation?.lat;
    const lng = asOptionalNumber(args.lng) ?? userContext.userLocation?.lng;

    if (lat == null || lng == null) {
      // No coordinates: the model must ask the user, not guess.
      return [];
    }

    const radiusKm = Math.min(Math.max(asOptionalNumber(args.radiusKm) ?? 2, 0.5), 10);
    const radiusM = Math.round(radiusKm * 1000);

    const cacheKey = `${category}:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusM}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      return cached.items;
    }

    try {
      const elements = await this.queryOverpass(filters, lat, lng, radiusM);
      const items = this.toItems(elements, lat, lng).slice(0, 10);

      this.cache.set(cacheKey, { at: Date.now(), items });
      if (this.cache.size > 200) {
        this.cache.delete(this.cache.keys().next().value as string);
      }

      return items;
    } catch (error) {
      this.logger.warn(
        `Overpass query failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private async queryOverpass(
    filters: string[],
    lat: number,
    lng: number,
    radiusM: number,
  ): Promise<OverpassElement[]> {
    // `nwr` covers nodes, ways and relations; `out center` gives ways a
    // usable coordinate instead of a list of nodes.
    const clauses = filters
      .map((filter) => `nwr[${filter}](around:${radiusM},${lat},${lng});`)
      .join('\n  ');

    const query = `[out:json][timeout:20];\n(\n  ${clauses}\n);\nout center 40;`;

    const endpoint =
      process.env.OVERPASS_URL?.trim() || 'https://overpass-api.de/api/interpreter';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass is a free community service and its usage policy
          // requires a real identifying User-Agent.
          'User-Agent': process.env.OSM_USER_AGENT?.trim() || 'stays4pilgrims/1.0',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Overpass returned ${response.status}`);
      }

      const data = (await response.json()) as { elements?: OverpassElement[] };
      return data.elements ?? [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private toItems(
    elements: OverpassElement[],
    lat: number,
    lng: number,
  ): RetrievedItem[] {
    const seen = new Set<string>();

    return elements
      .map((element): RetrievedItem | undefined => {
        const tags = element.tags ?? {};
        const name = tags.name?.trim();

        // Unnamed nodes are useless in an answer ("go to the unnamed café").
        // Drinking water is the exception: there, existence is the answer.
        if (!name && tags.amenity !== 'drinking_water') return undefined;

        const elLat = element.lat ?? element.center?.lat;
        const elLng = element.lon ?? element.center?.lon;
        if (elLat == null || elLng == null) return undefined;

        const key = (name ?? `water-${element.id}`).toLowerCase();
        if (seen.has(key)) return undefined;
        seen.add(key);

        const kind =
          tags.amenity ?? tags.shop ?? tags.tourism ?? tags.historic ?? 'place';

        const bits: string[] = [CATEGORY_LABELS[kind] ?? kind.replace(/_/g, ' ')];

        if (tags.cuisine) bits.push(`cuisine: ${tags.cuisine.replace(/;/g, ', ')}`);
        if (tags.opening_hours) bits.push(`hours: ${tags.opening_hours}`);
        if (tags.phone ?? tags['contact:phone']) {
          bits.push(`phone: ${tags.phone ?? tags['contact:phone']}`);
        }
        if (tags.wheelchair === 'yes') bits.push('wheelchair accessible');
        if (tags.outdoor_seating === 'yes') bits.push('outdoor seating');

        const distanceKm = this.haversineKm(lat, lng, elLat, elLng);
        bits.push(`${Math.round(distanceKm * 1000)} m away`);

        return {
          kind: 'poi' as const,
          id: `${element.type}/${element.id}`,
          title: name ?? 'Drinking water point',
          summary: bits.join(' · '),
          distanceKm,
          url: tags.website ?? tags['contact:website'],
          extra: {
            // No reliable price data exists in OSM. Surfacing the raw tag lets
            // the model say "cheaper end" without inventing euro amounts.
            priceRange: tags.price_range,
            osmKind: kind,
          },
        };
      })
      .filter((item): item is RetrievedItem => item !== undefined)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    return 6371 * 2 * Math.asin(Math.sqrt(a));
  }
}