import { Inject, Injectable } from '@nestjs/common';
import {
  KnowledgeRetriever,
  RetrievalContext,
  RetrievedItem,
  ToolSpec,
  asOptionalString,
} from '../knowledge-retriever';

export const CAMINOS_PORT = 'CAMINOS_PORT';

export type CaminoChatRow = {
  id: string | number;
  name: string;
  startLocality?: string | null;
  endLocality?: string | null;
  totalDistanceKm?: number | null;
  stagesCount?: number | null;
  description?: string | null;
};

export interface CaminosPort {
  findForChat(params: { nameContains?: string; limit: number }): Promise<
    CaminoChatRow[]
  >;
}

@Injectable()
export class CaminosRetriever implements KnowledgeRetriever {
  readonly domain = 'caminos';

  readonly tool: ToolSpec = {
    name: 'search_caminos',
    description:
      'List the Caminho de Santiago routes available in the app, with their start and end points, total distance and number of stages. Use when the user asks which routes exist or how they compare.',
    parameters: {
      type: 'object',
      properties: {
        nameContains: {
          type: 'string',
          description:
            'Filter by part of the route name, e.g. "Português". Omit to list all.',
        },
      },
      required: [],
    },
  };

  constructor(@Inject(CAMINOS_PORT) private readonly caminos: CaminosPort) {}

  async search(args: Record<string, unknown>, _ctx: RetrievalContext) {
    const rows = await this.caminos.findForChat({
      nameContains: asOptionalString(args.nameContains),
      limit: 10,
    });

    return rows.map((row) => this.toItem(row));
  }

  private toItem(row: CaminoChatRow): RetrievedItem {
    const bits: string[] = [];
    if (row.startLocality && row.endLocality) {
      bits.push(`${row.startLocality} to ${row.endLocality}`);
    }
    if (row.totalDistanceKm != null) bits.push(`${row.totalDistanceKm} km total`);
    if (row.stagesCount != null) bits.push(`${row.stagesCount} stages`);
    if (row.description) bits.push(row.description.slice(0, 160));

    return {
      kind: 'camino',
      id: row.id,
      title: row.name,
      summary: bits.join(' · '),
      extra: { totalDistanceKm: row.totalDistanceKm ?? undefined },
    };
  }
}