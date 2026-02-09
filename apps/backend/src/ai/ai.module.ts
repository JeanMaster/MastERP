import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { ContextBuilderService } from './context-builder.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AIController],
    providers: [AIService, ContextBuilderService],
    exports: [AIService],
})
export class AIModule { }
