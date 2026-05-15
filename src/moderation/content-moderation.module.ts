import { Global, Module } from '@nestjs/common';
import { ContentModerationService } from './content-moderation.service';

@Global()
@Module({
  providers: [ContentModerationService],
  exports: [ContentModerationService],
})
export class ContentModerationModule {}