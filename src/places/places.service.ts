import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Place } from './entities/place.entity';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { PlaceDto } from './dto/place.dto';
import { CreatePlaceDto } from './dto/create-place.dto';
import { PlaceCategory } from 'src/place-categories/entities/place-category.entity';
@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
    @InjectRepository(PlaceCategory)
    private readonly categoryRepo: Repository<PlaceCategory>,
  ) {}

  async findAll(page: number = 1, limit: number = 10): Promise<PlaceDto[]> {
    console.time('DB_FIND_PLACES');
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

    console.timeEnd('DB_FIND_PLACES');

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

  /*async create(data: Partial<Place>): Promise<Place> {
    const new = this.placeRepository.create(data);
    return this.placeRepository.save(novo);
  }*/

  async create(data: CreatePlaceDto): Promise<PlaceDto> {
    let category: PlaceCategory | undefined;

    if (data.place_category) {
      const found = await this.categoryRepo.findOne({
        where: { id: data.place_category },
      });

      if (!found) {
        throw new Error(
          `Categoria com id ${data.place_category} não encontrada`,
        );
      }

      category = found; // nunca será null aqui
    }

    const novo = this.placeRepository.create({
      ...data,
      place_category: category,
    });

    const saved: Place = await this.placeRepository.save(novo);

    return plainToInstance(PlaceDto, saved, { excludeExtraneousValues: true });
  }

  /* async create(data: CreatePlaceDto): Promise<PlaceDto> {
    const novo = this.placeRepository.create(data);
    const saved = await this.placeRepository.save(novo);
    return plainToInstance(PlaceDto, saved, { excludeExtraneousValues: true });
  }*/

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
