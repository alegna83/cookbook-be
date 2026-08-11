import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stage } from './entities/stage.entity';

@Injectable()
export class StagesService {
  constructor(
    @InjectRepository(Stage)
    private stageRepository: Repository<Stage>,
  ) {}

  findAll() {
    return this.stageRepository.find();
  }

  async findForChat(params: {
    caminoName?: string;
    locality?: string;
    limit: number;
  }): Promise<
    Array<{
      id: number;
      name: string;
      caminoName?: string | null;
      fromLocality?: string | null;
      toLocality?: string | null;
      distanceKm?: number | null;
      difficulty?: string | null;
      elevationGainM?: number | null;
      description?: string | null;
    }>
  > {
    const limit = Math.min(Math.max(Math.floor(params.limit || 6), 1), 20);

    const stages = await this.stageRepository
      .createQueryBuilder('stage')
      .leftJoin('stage.camino', 'camino')
      .leftJoin('stage.places', 'place')
      .select([
        'stage.id AS id',
        'stage.name AS name',
        'camino.name AS caminoName',
        'COUNT(DISTINCT place.id) AS linkedPlacesCount',
      ])
      .where('1 = 1')
      .groupBy('stage.id')
      .addGroupBy('stage.name')
      .addGroupBy('camino.name')
      .orderBy('stage.name', 'ASC')
      .take(limit);

    if (params.caminoName) {
      stages.andWhere('LOWER(BTRIM(camino.name)) = LOWER(BTRIM(:caminoName))', {
        caminoName: params.caminoName,
      });
    }

    if (params.locality) {
      stages.andWhere(
        '(LOWER(BTRIM(place.region)) = LOWER(BTRIM(:locality)) OR LOWER(BTRIM(stage.name)) LIKE LOWER(:localityLike))',
        {
          locality: params.locality,
          localityLike: `%${params.locality}%`,
        },
      );
    }

    const rows = await stages.getRawMany();

    return rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      name: String(row.name ?? ''),
      caminoName: row.caminoname != null ? String(row.caminoname) : row.caminoName != null ? String(row.caminoName) : null,
      fromLocality: null,
      toLocality: null,
      distanceKm: null,
      difficulty: null,
      elevationGainM: null,
      description: row.linkedplacescount != null ? `${Number(row.linkedplacescount)} linked accommodations` : null,
    }));
  }
}
