import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Place } from './entities/place.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
  ) {}

  async findAll(page: number = 1, limit: number = 10): Promise<Place[]> {
    return this.placeRepository.find({
      relations: ['camino', 'stage', 'gallery_photos', 'place_category'],
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(id: number): Promise<Place> {
    const place = await this.placeRepository.findOne({
      where: { id },
      relations: ['camino', 'stage', 'gallery_photos', 'place_category'],
    });
    if (!place) {
      throw new NotFoundException(`Place com id ${id} não encontrado`);
    }
    return place;
  }

  async create(data: Partial<Place>): Promise<Place> {
    const novo = this.placeRepository.create(data);
    return this.placeRepository.save(novo);
  }
}
