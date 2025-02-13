import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Todo } from './todo.entity';
import { TODOS_MOCK } from 'src/db/todos.mock';

@Injectable()
export class TodoService {
  private todos = TODOS_MOCK;
  
  findAll() {
    return this.todos;
  }

  findOne(id: number) {
    return this.todos.find((todo) => todo.id === id);
  }

  /*constructor(
    @InjectRepository(Todo)
    private readonly todoRepository: Repository<Todo>,
  ){}

  async findAll(): Promise<Todo[]> {
    return this.todoRepository.find();
  }*/
}
