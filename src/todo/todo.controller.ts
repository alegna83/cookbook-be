import { Controller, Get, Param } from '@nestjs/common';
import { TodoService } from './todo.service';
import { Todo } from './todo.entity';

@Controller('todos')
export class TodoController {
  constructor(private readonly todoService: TodoService){}

  @Get()
  getAllTodos(){
    return this.todoService.findAll();
  }

  @Get(':id')
  getTodoById(@Param('id') id: string){
    return this.todoService.findOne(Number(id))
  }
}
