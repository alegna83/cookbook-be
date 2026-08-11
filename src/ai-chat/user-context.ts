export type GeoPoint = { lat: number; lng: number };

export type LocationSource = 'gps' | 'map-center' | 'manual' | 'unknown';

export type VisibleAccommodation = {
  id: string | number;
  name: string;
  category?: string;
  priceBed?: number;
};

export type UserChatContext = {
  userLocation?: GeoPoint;
  locationSource?: LocationSource;
  /** Human-readable place name. Fill it in — the model reasons badly on raw coordinates. */
  locality?: string;
  route?: string;
  stage?: string;
  radiusKm?: number;
  isAuthenticated?: boolean;
  selectedAccommodationId?: string | number;
  filters?: Record<string, unknown>;
  /** What is currently drawn on the user's map. Lets "which of these?" work. */
  visibleAccommodations?: VisibleAccommodation[];
};

const MAX_VISIBLE = 8;

const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 50;
const DEFAULT_RADIUS_KM = 15;

function asString(value: unknown, maxLength = 120): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function asGeoPoint(value: unknown): GeoPoint | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const raw = value as Record<string, unknown>;
  const lat = Number(raw.lat ?? raw.latitude);
  const lng = Number(raw.lng ?? raw.longitude ?? raw.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  // (0,0) is almost always an uninitialised value, not a real position.
  if (lat === 0 && lng === 0) return undefined;

  return { lat, lng };
}

function asVisibleAccommodations(value: unknown): VisibleAccommodation[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const items = value
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === 'object',
    )
    .map((entry): VisibleAccommodation | undefined => {
      const id = entry.id;
      const name = asString(entry.name, 120);

      if ((typeof id !== 'string' && typeof id !== 'number') || !name) {
        return undefined;
      }

      const priceBed = Number(entry.priceBed);

      return {
        id,
        name,
        category: asString(entry.category, 60),
        priceBed: Number.isFinite(priceBed) && priceBed > 0 ? priceBed : undefined,
      };
    })
    .filter((item): item is VisibleAccommodation => item !== undefined)
    .slice(0, MAX_VISIBLE);

  return items.length > 0 ? items : undefined;
}

/** Never trust the client blindly: validate and clamp everything. */
export function parseUserContext(raw?: Record<string, unknown>): UserChatContext {
  if (!raw) return {};

  const source = asString(raw.locationSource, 20) as LocationSource | undefined;
  const radius = Number(raw.radiusKm);

  return {
    userLocation: asGeoPoint(raw.userLocation ?? raw.location),
    locationSource:
      source && ['gps', 'map-center', 'manual', 'unknown'].includes(source)
        ? source
        : undefined,
    locality: asString(raw.locality ?? raw.city),
    route: asString(raw.route),
    stage: asString(raw.stage),
    radiusKm: Number.isFinite(radius)
      ? Math.min(Math.max(radius, MIN_RADIUS_KM), MAX_RADIUS_KM)
      : DEFAULT_RADIUS_KM,
    isAuthenticated: raw.isAuthenticated === true,
    selectedAccommodationId:
      typeof raw.selectedAccommodationId === 'string' ||
      typeof raw.selectedAccommodationId === 'number'
        ? raw.selectedAccommodationId
        : undefined,
    filters:
      raw.filters && typeof raw.filters === 'object'
        ? (raw.filters as Record<string, unknown>)
        : undefined,
    visibleAccommodations: asVisibleAccommodations(raw.visibleAccommodations),
  };
}

/**
 * The client may not resend everything on every request (e.g. GPS unavailable
 * for one call). Keep whatever we already knew for this conversation.
 */
export function mergeUserContext(
  previous: UserChatContext,
  incoming: UserChatContext,
): UserChatContext {
  const merged: UserChatContext = { ...previous };

  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined && value !== null) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}

/**
 * Rendered into the prompt as plain sentences. Plain text works noticeably
 * better than raw JSON for making the model actually USE the information.
 */
export function describeUserContext(context: UserChatContext): string[] {
  const lines: string[] = [];

  if (context.locality && context.userLocation) {
    lines.push(
      `- Current location: ${context.locality} (${context.userLocation.lat.toFixed(4)}, ${context.userLocation.lng.toFixed(4)})`,
    );
  } else if (context.locality) {
    lines.push(`- Current location: ${context.locality}`);
  } else if (context.userLocation) {
    lines.push(
      `- Current coordinates: ${context.userLocation.lat.toFixed(4)}, ${context.userLocation.lng.toFixed(4)}`,
    );
  }

  if (context.locationSource === 'map-center') {
    lines.push('- Note: this position is the map centre, not a GPS fix.');
  }

  if (context.route) lines.push(`- Route being walked: ${context.route}`);
  if (context.stage) lines.push(`- Current stage: ${context.stage}`);
  if (context.radiusKm) lines.push(`- Search radius: ${context.radiusKm} km`);
  if (context.isAuthenticated === false) {
    lines.push(
      '- The user is NOT signed in, so the personalised "best accommodation" recommendation is unavailable to them.',
    );
  }
  if (context.filters && Object.keys(context.filters).length > 0) {
    lines.push(`- Active filters in the app: ${JSON.stringify(context.filters)}`);
  }

  if (context.selectedAccommodationId != null) {
    const selected = context.visibleAccommodations?.find(
      (item) => String(item.id) === String(context.selectedAccommodationId),
    );

    lines.push(
      selected
        ? `- The user currently has "${selected.name}" open on screen, so "this one"/"este" refers to it.`
        : `- The user currently has accommodation #${context.selectedAccommodationId} open on screen, so "this one"/"este" refers to it.`,
    );
  }

  if (context.visibleAccommodations?.length) {
    const listed = context.visibleAccommodations
      .map((item) => {
        const details = [item.category, item.priceBed ? `${item.priceBed} EUR` : undefined]
          .filter(Boolean)
          .join(', ');
        return details ? `${item.name} (${details})` : item.name;
      })
      .join('; ');

    lines.push(
      `- Currently visible on the user's map, so "these"/"estes" refers to them: ${listed}`,
    );
  }

  return lines;
}