import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccommodationCategory } from './entities/accommodation-category.entity';
import { AccommodationCategoriesService } from './accommodation-categories.service';
import { AccommodationCategoriesController } from './accommodation-categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccommodationCategory])],
  controllers: [AccommodationCategoriesController],
  providers: [AccommodationCategoriesService],
  exports: [TypeOrmModule],
})
export class AccommodationCategoriesModule {}
