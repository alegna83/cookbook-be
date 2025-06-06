import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoModule } from './todo/todo.module';
import { Account } from './accounts/account.entity';
import { AccountsModule } from './accounts/accounts.module';
import { AuthModule } from './auth/auth.module';
import { SuggestionModule } from './suggestions/suggestion.module';
import { HttpModule } from '@nestjs/axios';
import { PlacesModule } from './places/places.module';
import { PlaceCategoriesModule } from './place-categories/place-categories.module';
import { CaminosModule } from './caminos/caminos.module';
import { StagesModule } from './stages/stages.module';
import { Camino } from './caminos/entities/camino.entity';
import { Stage } from './stages/entities/stage.entity';
import { Place } from './places/entities/place.entity';
import { PlaceCategory } from './place-categories/entities/place-category.entity';
import { GalleryPhoto } from './gallery/entities/gallery-photo.entity';
import { PlacePrice } from './place-prices/entities/place-price.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [
        Account,
        Camino,
        Stage,
        Place,
        PlaceCategory,
        GalleryPhoto,
        PlacePrice,
      ],
      synchronize: true,
    }),
    AuthModule,
    TodoModule,
    AccountsModule,
    SuggestionModule,
    PlacesModule,
    PlaceCategoriesModule,
    CaminosModule,
    StagesModule,
    HttpModule,
  ],
})
export class AppModule {}
