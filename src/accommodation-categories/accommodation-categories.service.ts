import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccommodationCategory } from './entities/accommodation-category.entity';

@Injectable()
export class AccommodationCategoriesService {
  constructor(
    @InjectRepository(AccommodationCategory)
    private categoryRepository: Repository<AccommodationCategory>,
  ) {}

  findAll() {
    return this.categoryRepository.find();
  }
}
