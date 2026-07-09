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
  private readonly readCache = new Map<
    string,
    { expiresAt: number; value: unknown }
  >();

  private readonly pendingReads = new Map<string, Promise<unknown>>();

  private readonly cacheTtlMs = (() => {
    const defaultTtl = process.env.NODE_ENV === 'production' ? 300000 : 60000;
    const parsed = Number(process.env.CAMINOS_CACHE_TTL_MS ?? defaultTtl);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultTtl;
  })();

  constructor(
    @InjectRepository(Camino)
    private caminoRepository: Repository<Camino>,
  ) {}

  private getCachedValue<T>(key: string): T | undefined {
    const cached = this.readCache.get(key);

    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt <= Date.now()) {
      this.readCache.delete(key);
      return undefined;
    }

    return cached.value as T;
  }

  private setCachedValue<T>(key: string, value: T): T {
    this.readCache.set(key, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return value;
  }

  private async getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.getCachedValue<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const pending = this.pendingReads.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    const promise = (async () => {
      try {
        const value = await loader();
        return this.setCachedValue(key, value);
      } finally {
        this.pendingReads.delete(key);
      }
    })();

    this.pendingReads.set(key, promise);
    return promise;
  }

  async findAll(): Promise<any[]> {
    return this.getOrLoad('findAll', async () => {
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

      return (await this.caminoRepository.query(query)) as Camino[];
    });
  }
}
