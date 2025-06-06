import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Camino } from './entities/camino.entity';

@Injectable()
export class CaminosService {
  constructor(
    @InjectRepository(Camino)
    private caminoRepository: Repository<Camino>,
  ) {}

  async findAll(): Promise<Camino[]> {
    return this.caminoRepository.find();
  }
}
