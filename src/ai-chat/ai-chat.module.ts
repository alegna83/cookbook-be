import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { ChatSessionStore } from './chat-session.store';
import { KNOWLEDGE_RETRIEVERS, KnowledgeRetriever } from './knowledge-retriever';

import {
  ACCOMMODATIONS_PORT,
  AccommodationsRetriever,
} from './retrievers/accomodations.retriever';
import { STAGES_PORT, StagesRetriever } from './retrievers/stages.retriever';
import { AccommodationsModule } from '../accommodations/accommodations.module';
import { AccommodationsService } from '../accommodations/accommodations.service';
import { StagesModule } from '../stages/stages.module';
import { StagesService } from '../stages/stages.service';
import { CaminosModule } from '../caminos/caminos.module';
import { CaminosService } from '../caminos/caminos.service';
import { CAMINOS_PORT, CaminosRetriever } from './retrievers/caminos.retriever';

@Module({
  imports: [AccommodationsModule, StagesModule, CaminosModule],
  controllers: [AiChatController],
  providers: [
    AiChatService,
    ChatSessionStore,

    // Each port is implemented by one `findForChat()` method on your existing
    // service. See the contract at the top of each retriever file.
    { provide: ACCOMMODATIONS_PORT, useExisting: AccommodationsService },
    { provide: STAGES_PORT, useExisting: StagesService },
    { provide: CAMINOS_PORT, useExisting: CaminosService },

    AccommodationsRetriever,
    StagesRetriever,
    CaminosRetriever,

    // Add a domain: write the retriever, register it here, add it to `inject`.
    // Nothing in AiChatService changes; the tool list in the prompt is built
    // from whatever is in this array.
    {
      provide: KNOWLEDGE_RETRIEVERS,
      useFactory: (...retrievers: KnowledgeRetriever[]) => retrievers,
      inject: [AccommodationsRetriever, StagesRetriever, CaminosRetriever],
    },
  ],
  exports: [AiChatService],
})
export class AiChatModule {}