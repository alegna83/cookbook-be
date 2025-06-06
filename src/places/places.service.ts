import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Place } from './entities/place.entity';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { PlaceDto } from './dto/place.dto';
@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
  ) {}

  async findAll(page: number = 1, limit: number = 10): Promise<PlaceDto[]> {
    const places = await this.placeRepository.find({
      relations: [
        'camino',
        'stage',
        'gallery_photos',
        'place_category',
        'prices',
      ],
      skip: (page - 1) * limit,
      take: limit,
    });

    return plainToInstance(PlaceDto, places, { excludeExtraneousValues: true });
  }

  async findOne(id: number): Promise<PlaceDto> {
    const place = await this.placeRepository.findOne({
      where: { id },
      relations: [
        'camino',
        'stage',
        'gallery_photos',
        'place_category',
        'prices',
      ],
    });
    if (!place) {
      throw new NotFoundException(`Place com id ${id} não encontrado`);
    }
    return plainToInstance(PlaceDto, place, { excludeExtraneousValues: true });
  }

  async create(data: Partial<Place>): Promise<Place> {
    const novo = this.placeRepository.create(data);
    return this.placeRepository.save(novo);
  }

  async findByCamino(caminoName: string): Promise<Place[]> {
    return this.placeRepository.find({
      where: { camino: { name: caminoName } },
      relations: ['camino'],
    });
  }

  getByBounds(bounds: any) {
    const { south, west, north, east } = bounds;
    return this.placeRepository
      .createQueryBuilder('place')
      .leftJoinAndSelect('place.place_category', 'place_category')
      .leftJoinAndSelect('place.gallery_photos', 'gallery_photos')
      .where('place.latitude BETWEEN :south AND :north', { south, north })
      .andWhere('place.longitude BETWEEN :west AND :east', { west, east })
      .getMany();
  }
}
