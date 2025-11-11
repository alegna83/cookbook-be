import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Camino } from './entities/camino.entity';

/*@Injectable()
export class CaminosService {
  constructor(
    @InjectRepository(Camino)
    private caminoRepository: Repository<Camino>,
  ) {}

  async findAll(): Promise<Camino[]> {
    return this.caminoRepository.find({
      order: {
        ranking: 'ASC',
        name: 'ASC',
      },
    });
  }
}*/

@Injectable()
export class CaminosService {
  constructor(
    @InjectRepository(Camino)
    private caminoRepository: Repository<Camino>,
  ) {}

  async findAll(): Promise<any[]> {
    // Query crua SQL usando a função f(x) = 1/(1 + x²)
    // Normaliza o número de peregrinos dividindo pelo máximo global
    const query = `
      WITH stats AS (
      SELECT
        s.camino_id,
        s.number_pilgrims::float / NULLIF(MAX(s.number_pilgrims) OVER (), 0) AS x_norm,
        s.month_index
      FROM statistics_caminos s
    ),
    scores AS (
      SELECT
        camino_id,
        SUM(1 - (1 / (1 + POWER(x_norm, 2)))) AS ranking_score
      FROM stats
      GROUP BY camino_id
    )
    SELECT
      c.id,
      c.name,
      c.ranking,
      c.is_popular,
      c.parent_camino_id,
      c.active,
      COALESCE(sc.ranking_score, 0) AS ranking_score
    FROM caminos c
    LEFT JOIN scores sc ON sc.camino_id = c.id
    WHERE c.active = true
    ORDER BY COALESCE(sc.ranking_score::float, 0) DESC, c.name ASC;
    `;

    const caminos = (await this.caminoRepository.query(query)) as Camino[];
    console.log('Caminos with ranking scores:', caminos);
    return caminos;
  }
}
