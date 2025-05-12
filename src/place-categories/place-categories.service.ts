import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlaceCategory } from './entities/place-category.entity';

@Injectable()
export class PlaceCategoriesService {
  constructor(
    @InjectRepository(PlaceCategory)
    private categoryRepository: Repository<PlaceCategory>,
  ) {}

  findAll() {
    return this.categoryRepository.find();
  }
}
