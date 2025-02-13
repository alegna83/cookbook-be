import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoModule } from './todo/todo.module';

@Module({
  imports: [
    // ConfigModule.forRoot(),
    // TypeOrmModule.forRoot({
    //   type: 'postgres',
    //   host: process.env.DB_HOST || 'localhost',
    //   port: parseInt(process.env.DB_PORT ?? '5432', 10),
    //   username: process.env.DB_USER || 'postgres',
    //   password: process.env.DB_PASS || 'password',
    //   database: process.env.DB_NAME || 'todos',
    //   autoLoadEntities: true,
    //   synchronize: true,
    // }),
    TodoModule,
  ],
})
export class AppModule {}
