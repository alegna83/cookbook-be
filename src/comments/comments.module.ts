import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { Accommodation } from '../accommodations/entities/accommodation.entity';
import { Account } from '../accounts/account.entity';
import { ContentModerationModule } from 'src/moderation/content-moderation.module';
import { EmailService } from 'src/auth/email.service';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Accommodation, Account]), ContentModerationModule],
  providers: [CommentsService, EmailService],
  controllers: [CommentsController],
  exports: [CommentsService],
})
export class CommentsModule {}