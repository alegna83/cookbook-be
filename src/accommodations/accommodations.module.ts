import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccommodationsService } from './accommodations.service';
import { AccommodationsController } from './accommodations.controller';
import { Accommodation } from './entities/accommodation.entity';
import { Camino } from '../caminos/entities/camino.entity';
import { Stage } from '../stages/entities/stage.entity';
import { AccommodationCategory } from '../accommodation-categories/entities/accommodation-category.entity';
import { GalleryPhoto } from 'src/gallery/entities/gallery-photo.entity';
import { AccommodationPrice } from 'src/place-prices/entities/place-price.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Accommodation,
      Camino,
      Stage,
      AccommodationCategory,
      GalleryPhoto,
      AccommodationPrice,
    ]),
  ],
  controllers: [AccommodationsController],
  providers: [AccommodationsService],
})
export class AccommodationsModule {}
