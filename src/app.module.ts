import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TodoModule } from './todo/todo.module';
import { AccountsModule } from './accounts/accounts.module';
import { AuthModule } from './auth/auth.module';
import { SuggestionModule } from './suggestions/suggestion.module';
import { AccommodationsModule } from './accommodations/accommodations.module';
import { AccommodationCategoriesModule } from './accommodation-categories/accmmodation-categories.module';
import { CaminosModule } from './caminos/caminos.module';
import { StagesModule } from './stages/stages.module';
import { StatisticsCaminosModule } from './statistics-caminos/statistics-caminos.module';
import { FavoritesModule } from './favorites/favorites.module';
import { CommentsModule } from './comments/comments.module';
import { UploadModule } from './upload/upload.module';
import { ContentModerationModule } from './moderation/content-moderation.module';
import { join } from 'path';
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
        const runMigrationsOnBoot =
          configService.get<string>('DB_RUN_MIGRATIONS_ON_BOOT') === 'true';

        if (requestedSynchronize) {
          console.warn(
            '[DB] DB_SYNCHRONIZE=true foi ignorado. O backend força synchronize=false e usa apenas migrations.',
          );
        }

        if (runMigrationsOnBoot) {
          console.warn(
            '[DB] DB_RUN_MIGRATIONS_ON_BOOT=true: migrations will run during application startup.',
          );
        }

        return {
          type: 'postgres',
          url: configService.get<string>('DATABASE_URL'),
          autoLoadEntities: true,
          migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
          migrationsRun: runMigrationsOnBoot,
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
    FavoritesModule,
    CommentsModule,
    UploadModule,
    ContentModerationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
