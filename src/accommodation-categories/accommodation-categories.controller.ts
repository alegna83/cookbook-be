import { Controller, Get } from '@nestjs/common';
import { AccommodationCategoriesService } from './accommodation-categories.service';

@Controller('accommodation-categories')
export class AccommodationCategoriesController {
  constructor(
    private readonly categoriesService: AccommodationCategoriesService,
  ) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }
}
