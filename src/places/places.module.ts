import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlacesService } from './places.service';
import { PlacesController } from './places.controller';
import { Place } from './entities/place.entity';
import { Camino } from '../caminos/entities/camino.entity';
import { Stage } from '../stages/entities/stage.entity';
import { PlaceCategory } from '../place-categories/entities/place-category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Place, Camino, Stage, PlaceCategory])],
  controllers: [PlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
