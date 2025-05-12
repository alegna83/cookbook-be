import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Camino } from './entities/camino.entity';
import { CaminosService } from './caminos.service';
import { CaminosController } from './caminos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Camino])],
  controllers: [CaminosController],
  providers: [CaminosService],
  exports: [TypeOrmModule],
})
export class CaminosModule {}
