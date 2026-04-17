// src/suggestions/suggestion.module.ts
import { Module } from '@nestjs/common';
import { SuggestionController } from './suggestion.controller';
import { SuggestionService } from './suggestion.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AccommodationsModule } from '../accommodations/accommodations.module';

@Module({
  imports: [HttpModule, ConfigModule, AccommodationsModule],
  controllers: [SuggestionController],
  providers: [SuggestionService],
})
export class SuggestionModule {}
