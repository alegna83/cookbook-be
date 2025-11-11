import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { StatisticsCaminosService } from './statistics-caminos.service';
import { StatisticsCaminosDto } from './dto/statistics-caminos.dto';

@Controller('statistics-caminos')
export class StatisticsCaminosController {
  constructor(private readonly statsService: StatisticsCaminosService) {}

  @Post()
  async create(@Body() dto: StatisticsCaminosDto) {
    return this.statsService.create(dto);
  }

  @Get()
  async findAll() {
    return this.statsService.findAll();
  }

  @Get(':caminoId')
  async findByCamino(@Param('caminoId') caminoId: number) {
    return this.statsService.findByCamino(caminoId);
  }
}
