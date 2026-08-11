import { Inject, Injectable } from '@nestjs/common';
import {
  KnowledgeRetriever,
  RetrievalContext,
  RetrievedItem,
  ToolSpec,
  asOptionalNumber,
  asOptionalString,
} from '../knowledge-retriever';

/**
 * The single method you need to add to AccommodationsService.
 * Keeping it as a port means the chat never depends on the internals of the
 * accommodations module — only on this contract.
 */
export const ACCOMMODATIONS_PORT = 'ACCOMMODATIONS_PORT';

export type AccommodationChatRow = {
  id: string | number;
  name: string;
  type?: string | null;
  locality?: string | null;
  priceFrom?: number | null;
  rating?: number | null;
  reviewsCount?: number | null;
  distanceKm?: number | null;
  /** Maps to Accommodation.services in the Flutter model. */
  services?: string[] | null;
  /** Maps to Accommodation.nearbyActivities. */
  nearbyActivities?: string[] | null;
  pilgrimExclusive?: boolean | null;
  allowsReservations?: boolean | null;
  datesOpen?: string | null;
};

export interface AccommodationsPort {
  findForChat(params: {
    locality?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    maxPriceEur?: number;
    type?: string;
    /** Free-text service to match, e.g. "lavandaria", "pequeno-almoço". */
    service?: string;
    limit: number;
  }): Promise<AccommodationChatRow[]>;
}

@Injectable()
export class AccommodationsRetriever implements KnowledgeRetriever {
  readonly domain = 'accommodations';

  readonly tool: ToolSpec = {
    name: 'search_accommodations',
    description:
      'Search places registered in the Stays4Pilgrims database (albergues, hostels, guesthouses, hotels and pilgrim support points) near a locality or near the user. Each result also lists the services it offers and nearby activities, so use this for questions about where to sleep AND for questions about services available along the route (laundry, meals, wifi, luggage transfer, and so on).',
    parameters: {
      type: 'object',
      properties: {
        locality: {
          type: 'string',
          description:
            'Town or village to search in. Omit to use the user\'s current location.',
        },
        type: {
          type: 'string',
          description: 'Accommodation type, e.g. albergue, hostel, hotel, pensao.',
        },
        maxPriceEur: {
          type: 'number',
          description: 'Maximum price per night in euros.',
        },
        service: {
          type: 'string',
          description:
            'Service the user is looking for, e.g. laundry, breakfast, wifi, luggage transfer.',
        },
        radiusKm: {
          type: 'number',
          description: 'Search radius in km around the location. Defaults to 15.',
        },
      },
      required: [],
    },
  };

  constructor(
    @Inject(ACCOMMODATIONS_PORT)
    private readonly accommodations: AccommodationsPort,
  ) {}

  async search(
    args: Record<string, unknown>,
    { userContext }: RetrievalContext,
  ): Promise<RetrievedItem[]> {
    const locality = asOptionalString(args.locality) ?? userContext.locality;

    const rows = await this.accommodations.findForChat({
      locality,
      lat: userContext.userLocation?.lat,
      lng: userContext.userLocation?.lng,
      radiusKm:
        asOptionalNumber(args.radiusKm) ?? userContext.radiusKm ?? 15,
      maxPriceEur: asOptionalNumber(args.maxPriceEur),
      type: asOptionalString(args.type),
      service: asOptionalString(args.service),
      limit: 8,
    });

    return rows.map((row) => this.toItem(row));
  }

  private toItem(row: AccommodationChatRow): RetrievedItem {
    const bits: string[] = [];
    if (row.type) bits.push(row.type);
    if (row.locality) bits.push(row.locality);
    if (row.priceFrom != null) bits.push(`from ${row.priceFrom} EUR/night`);
    if (row.rating != null) {
      bits.push(`rated ${row.rating}/5 (${row.reviewsCount ?? 0} reviews)`);
    }
    if (row.distanceKm != null) bits.push(`${row.distanceKm.toFixed(1)} km away`);
    if (row.pilgrimExclusive) bits.push('pilgrims only');
    if (row.allowsReservations) bits.push('takes reservations');
    if (row.datesOpen) bits.push(`open: ${row.datesOpen}`);
    if (row.services?.length) {
      bits.push(`services: ${row.services.slice(0, 6).join(', ')}`);
    }
    if (row.nearbyActivities?.length) {
      bits.push(`nearby: ${row.nearbyActivities.slice(0, 4).join(', ')}`);
    }

    return {
      kind: 'accommodation',
      id: row.id,
      title: row.name,
      summary: bits.join(' · '),
      locality: row.locality ?? undefined,
      distanceKm: row.distanceKm ?? undefined,
      extra: {
        priceFrom: row.priceFrom ?? undefined,
        rating: row.rating ?? undefined,
      },
    };
  }
}