import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { StatisticsCaminos } from './statistics-caminos/entities/statistics-caminos.entity';
import { StatisticsCaminosModule } from './statistics-caminos/statistics-caminos.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true,
        /*host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),*/
        /*entities: [
          Account,
          Camino,
          Stage,
          Place,
          PlaceCategory,
          GalleryPhoto,
          PlacePrice,
        ],*/
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    TodoModule,
    AccountsModule,
    SuggestionModule,
    PlacesModule,
    PlaceCategoriesModule,
    CaminosModule,
    StagesModule,
    StatisticsCaminosModule,
    HttpModule,
  ],
})
export class AppModule {}
