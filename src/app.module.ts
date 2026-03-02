import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoModule } from './todo/todo.module';
import { AccountsModule } from './accounts/accounts.module';
import { AuthModule } from './auth/auth.module';
import { SuggestionModule } from './suggestions/suggestion.module';
import { HttpModule } from '@nestjs/axios';
import { AccommodationsModule } from './accommodations/accommodations.module';
import { AccommodationCategoriesModule } from './accommodation-categories/accmmodation-categories.module';
import { CaminosModule } from './caminos/caminos.module';
import { StagesModule } from './stages/stages.module';
import { StatisticsCaminosModule } from './statistics-caminos/statistics-caminos.module';
import { FavoritesModule } from './favorites/favorites.module';
import { CommentsModule } from './comments/comments.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const sslEnabled = configService.get<string>('DB_SSL') !== 'false';
        const sslStrict = configService.get<string>('DB_SSL_STRICT') === 'true';
        const requestedSynchronize =
          configService.get<string>('DB_SYNCHRONIZE') === 'true';

        if (requestedSynchronize) {
          console.warn(
            '[DB] DB_SYNCHRONIZE=true foi ignorado. O backend força synchronize=false e usa apenas migrations.',
          );
        }

        return {
          type: 'postgres',
          url: configService.get<string>('DATABASE_URL'),
          autoLoadEntities: true,
          // ⚠️ IMPORTANTE: Nunca usar synchronize: true em produção!
          // Use migrações: npm run migration:run
          synchronize: false,
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
        ssl: sslEnabled ? { rejectUnauthorized: sslStrict } : false,
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    TodoModule,
    AccountsModule,
    SuggestionModule,
    AccommodationsModule,
    AccommodationCategoriesModule,
    CaminosModule,
    StagesModule,
    StatisticsCaminosModule,
    HttpModule,
    FavoritesModule,
    CommentsModule,
  ],
})
export class AppModule {}
