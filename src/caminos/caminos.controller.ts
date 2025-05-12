import { Controller, Get } from '@nestjs/common';
import { CaminosService } from './caminos.service';

@Controller('caminos')
export class CaminosController {
  constructor(private readonly caminosService: CaminosService) {}

  @Get()
  findAll() {
    return this.caminosService.findAll();
  }
}
