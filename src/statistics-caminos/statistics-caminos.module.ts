import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsCaminos } from './entities/statistics-caminos.entity';
import { StatisticsCaminosService } from './statistics-caminos.service';
import { StatisticsCaminosController } from './statistics-caminos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StatisticsCaminos])],
  controllers: [StatisticsCaminosController],
  providers: [StatisticsCaminosService],
  exports: [StatisticsCaminosService],
})
export class StatisticsCaminosModule {}
