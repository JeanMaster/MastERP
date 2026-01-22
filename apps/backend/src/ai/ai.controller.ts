import { Controller, Get, Post, Body, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AIService } from './ai.service';
import type { AIChatRequest } from './interfaces/ai.interfaces';

@ApiTags('ai')
@Controller('ai')
export class AIController {
    private readonly logger = new Logger(AIController.name);
    constructor(private readonly aiService: AIService) { }

    @Get('daily-insights')
    @ApiOperation({ summary: 'Get AI-generated daily business insights and recommendations' })
    @ApiQuery({ name: 'refresh', required: false, type: Boolean, description: 'Force refresh cached insights' })
    async getDailyInsights(@Query('refresh') refresh?: string) {
        this.logger.log(`GET /api/ai/daily-insights?refresh=${refresh}`);
        try {
            const forceRefresh = refresh === 'true';
            return await this.aiService.getDailyInsights(forceRefresh);
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to generate insights',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('chat')
    @ApiOperation({ summary: 'Chat with AI assistant about business data' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', description: 'User question or message' },
                conversationHistory: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            role: { type: 'string', enum: ['user', 'assistant'] },
                            content: { type: 'string' }
                        }
                    },
                    description: 'Optional conversation history for context'
                }
            },
            required: ['message']
        }
    })
    async chat(@Body() request: AIChatRequest) {
        try {
            if (!request.message || request.message.trim().length === 0) {
                throw new HttpException('Message is required', HttpStatus.BAD_REQUEST);
            }
            return await this.aiService.chat(request);
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to process chat message',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('refresh-insights')
    @ApiOperation({ summary: 'Force refresh daily insights cache' })
    async refreshInsights() {
        try {
            this.aiService.clearCache();
            return await this.aiService.getDailyInsights(true);
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to refresh insights',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
