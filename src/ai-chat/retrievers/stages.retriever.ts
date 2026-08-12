import { Inject, Injectable } from '@nestjs/common';
import {
  KnowledgeRetriever,
  RetrievalContext,
  RetrievedItem,
  ToolSpec,
  asOptionalString,
} from '../knowledge-retriever';

export const STAGES_PORT = 'STAGES_PORT';

export type StageChatRow = {
  id: string | number;
  name: string;
  caminoName?: string | null;
  fromLocality?: string | null;
  toLocality?: string | null;
  distanceKm?: number | null;
  difficulty?: string | null;
  elevationGainM?: number | null;
  description?: string | null;
};

export interface StagesPort {
  findForChat(params: {
    caminoName?: string;
    locality?: string;
    limit: number;
  }): Promise<StageChatRow[]>;
}

@Injectable()
export class StagesRetriever implements KnowledgeRetriever {
  readonly domain = 'stages';

  readonly tool: ToolSpec = {
    name: 'search_stages',
    description:
      'Look up stages (etapas) of the Caminho: start and end points, distance, difficulty and elevation. Use for questions about the route itself, how long a day walk is, or what comes next.',
    parameters: {
      type: 'object',
      properties: {
        caminoName: {
          type: 'string',
          description: 'Name of the route, e.g. "Caminho Português Interior".',
        },
        locality: {
          type: 'string',
          description:
            'Town the stage starts or ends in. Omit to use the user\'s current location.',
        },
      },
      required: [],
    },
  };

  constructor(@Inject(STAGES_PORT) private readonly stages: StagesPort) {}

  async search(
    args: Record<string, unknown>,
    { userContext }: RetrievalContext,
  ): Promise<RetrievedItem[]> {
    const rows = await this.stages.findForChat({
      caminoName: asOptionalString(args.caminoName) ?? userContext.route,
      locality: asOptionalString(args.locality) ?? userContext.locality,
      limit: 6,
    });

    return rows.map((row) => this.toItem(row));
  }

  private toItem(row: StageChatRow): RetrievedItem {
    const bits: string[] = [];
    if (row.fromLocality && row.toLocality) {
      bits.push(`${row.fromLocality} to ${row.toLocality}`);
    }
    if (row.distanceKm != null) bits.push(`${row.distanceKm} km`);
    if (row.difficulty) bits.push(`difficulty: ${row.difficulty}`);
    if (row.elevationGainM != null) bits.push(`+${row.elevationGainM} m elevation`);
    if (row.description) bits.push(row.description.slice(0, 160));

    return {
      kind: 'stage',
      id: row.id,
      title: row.name,
      summary: bits.join(' · '),
      locality: row.toLocality ?? row.fromLocality ?? undefined,
      extra: {
        caminoName: row.caminoName ?? undefined,
        distanceKm: row.distanceKm ?? undefined,
      },
    };
  }
}