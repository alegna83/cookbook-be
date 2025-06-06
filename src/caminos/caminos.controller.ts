import { Controller, Post, Body, BadRequestException, HttpCode } from '@nestjs/common';
import { CaminosService } from './caminos.service';
import { HandleCaminoDto } from './dto/handle-camino.dto';

@Controller('caminos')
export class CaminosController {
  constructor(private readonly caminosService: CaminosService) {}

  /*@Get()
  findAll() {
    return this.caminosService.findAll();
  }*/

  @Post('handle')
  @HttpCode(200)
  async handle(@Body() data: HandleCaminoDto): Promise<any> {
    switch (data.action) {
      case 'getAll':
        return this.caminosService.findAll();

      default:
        throw new BadRequestException('Ação desconhecida.');
    }
  }
}
