import { Controller, Get } from '@nestjs/common';
import { PlaceCategoriesService } from './place-categories.service';

@Controller('place-categories')
export class PlaceCategoriesController {
  constructor(private readonly categoriesService: PlaceCategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }
}
