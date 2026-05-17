import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { Accommodation } from '../accommodations/entities/accommodation.entity';
import { ContentModerationModule } from 'src/moderation/content-moderation.module';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Accommodation]), ContentModerationModule],
  providers: [CommentsService],
  controllers: [CommentsController],
  exports: [CommentsService],
})
export class CommentsModule {}