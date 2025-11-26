import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { Place } from '../places/entities/place.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private favRepo: Repository<Favorite>,
    @InjectRepository(Place)
    private placeRepo: Repository<Place>,
  ) {}

  async add(dto: CreateFavoriteDto): Promise<Favorite> {
    const place = await this.placeRepo.findOne({ where: { id: dto.placeId } });
    if (!place) throw new BadRequestException('Place not found');

    const exists = await this.favRepo.findOne({
      where: { placeId: dto.placeId, accountId: dto.accountId },
    });
    if (exists) return exists;

    const fav = this.favRepo.create({
      placeId: dto.placeId,
      accountId: dto.accountId,
    });
    return this.favRepo.save(fav);
  }

  async remove(id: number, accountId?: number): Promise<void> {
    const fav = await this.favRepo.findOne({ where: { id } });
    if (!fav) throw new NotFoundException('Favorite not found');
    if (accountId && fav.accountId !== accountId) {
      throw new BadRequestException('Not allowed to delete this favorite');
    }
    await this.favRepo.remove(fav);
  }

  async listByAccount(accountId: number): Promise<Favorite[]> {
    return this.favRepo.find({
      where: { accountId },
      order: { createdAt: 'DESC' },
    });
  }

  async exists(accountId: number, placeId: number): Promise<boolean> {
    const f = await this.favRepo.findOne({ where: { accountId, placeId } });
    return !!f;
  }

  async toggle(accountId: number, placeId: number): Promise<{ added: boolean; favorite?: Favorite }> {
    const existing = await this.favRepo.findOne({ where: { accountId, placeId } });
    if (existing) {
      await this.favRepo.remove(existing);
      return { added: false };
    }
    const created = this.favRepo.create({ accountId, placeId });
    const saved = await this.favRepo.save(created);
    return { added: true, favorite: saved };
  }
}