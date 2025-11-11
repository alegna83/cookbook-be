import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StatisticsCaminos } from './entities/statistics-caminos.entity';
import { StatisticsCaminosDto } from './dto/statistics-caminos.dto';

@Injectable()
export class StatisticsCaminosService {
  constructor(
    @InjectRepository(StatisticsCaminos)
    private statsRepository: Repository<StatisticsCaminos>,
  ) {}

  async create(dto: StatisticsCaminosDto): Promise<StatisticsCaminos> {
    const stat = this.statsRepository.create(dto);
    return this.statsRepository.save(stat);
  }

  async findAll(): Promise<StatisticsCaminos[]> {
    return this.statsRepository.find({
      relations: ['camino'],
      order: { year: 'DESC', month: 'DESC' },
    });
  }

  async findByCamino(caminoId: number): Promise<StatisticsCaminos[]> {
    const stats = await this.statsRepository.find({
      where: { caminoId },
      order: { year: 'DESC', month: 'DESC' },
    });

    if (!stats.length) {
      throw new NotFoundException('Nenhuma estatística encontrada para este caminho');
    }

    return stats;
  }
}
