import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaceCategory } from './entities/place-category.entity';
import { PlaceCategoriesService } from './place-categories.service';
import { PlaceCategoriesController } from './place-categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlaceCategory])],
  controllers: [PlaceCategoriesController],
  providers: [PlaceCategoriesService],
  exports: [TypeOrmModule],
})
export class PlaceCategoriesModule {}
