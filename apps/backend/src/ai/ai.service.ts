import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ContextBuilderService } from './context-builder.service';
import {
    BusinessContext,
    AIRecommendation,
    AIInsightsResponse,
    AIChatRequest,
    AIChatResponse,
} from './interfaces/ai.interfaces';

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);
    private genAI: GoogleGenerativeAI;
    private insightsCache: { data: AIInsightsResponse; expiresAt: Date } | null = null;

    constructor(private contextBuilder: ContextBuilderService) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not found in environment variables. AI features will be disabled.');
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.logger.log('Gemini AI initialized successfully');
        }
    }

    private readonly SYSTEM_PROMPT = `Eres un asesor financiero experto especializado en negocios retail en Venezuela.

Tu objetivo es analizar datos del negocio y generar recomendaciones ACCIONABLES y ESPECÍFICAS.

CONTEXTO VENEZOLANO:
- Economía dolarizada con inflación
- Uso de múltiples monedas (Bs, USD, Zelle, USDT)
- Importancia del flujo de caja
- Gestión de inventario crítica

ESTILO DE COMUNICACIÓN:
- Directo y profesional
- Enfocado en acciones concretas
- Prioriza rentabilidad y liquidez
- Usa números específicos del contexto`;

    async getDailyInsights(forceRefresh = false): Promise<AIInsightsResponse> {
        // Check cache
        if (!forceRefresh && this.insightsCache && this.insightsCache.expiresAt > new Date()) {
            this.logger.log('Returning cached insights');
            return this.insightsCache.data;
        }

        if (!this.genAI) {
            throw new Error('Gemini AI not initialized. Check GEMINI_API_KEY environment variable.');
        }

        this.logger.log('Generating fresh insights...');

        const context = await this.contextBuilder.buildContext('today');
        const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `${this.SYSTEM_PROMPT}

DATOS DEL NEGOCIO:
${JSON.stringify(context, null, 2)}

TAREA:
Analiza los datos y genera 3-5 recomendaciones ACCIONABLES.

Prioriza:
1. Problemas críticos (stock bajo, liquidez, deudas)
2. Oportunidades de mejora (productos top, tendencias)
3. Optimizaciones operativas

FORMATO DE RESPUESTA (JSON estricto):
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Título corto y directo",
      "description": "Explicación detallada con números del contexto",
      "action": "Acción específica que el dueño puede tomar HOY",
      "category": "sales" | "inventory" | "finance" | "operations"
    }
  ]
}

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional.`;

        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            // Clean response (remove markdown code blocks if present)
            const cleanedText = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            const parsed = JSON.parse(cleanedText);

            const insights: AIInsightsResponse = {
                recommendations: parsed.recommendations || [],
                generatedAt: new Date().toISOString(),
                contextPeriod: context.period,
            };

            // Cache for 24 hours
            this.insightsCache = {
                data: insights,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            };

            this.logger.log(`Generated ${insights.recommendations.length} recommendations`);
            return insights;
        } catch (error) {
            this.logger.error('Error generating insights:', error);
            throw new Error('Failed to generate AI insights. Please try again later.');
        }
    }

    async chat(request: AIChatRequest): Promise<AIChatResponse> {
        if (!this.genAI) {
            throw new Error('Gemini AI not initialized. Check GEMINI_API_KEY environment variable.');
        }

        this.logger.log('Processing chat message...');

        const context = await this.contextBuilder.buildContext('today');
        const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Build conversation history
        let conversationContext = '';
        if (request.conversationHistory && request.conversationHistory.length > 0) {
            conversationContext = request.conversationHistory
                .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
                .join('\n');
        }

        const prompt = `${this.SYSTEM_PROMPT}

DATOS ACTUALES DEL NEGOCIO:
${JSON.stringify(context, null, 2)}

${conversationContext ? `HISTORIAL DE CONVERSACIÓN:\n${conversationContext}\n` : ''}

PREGUNTA DEL USUARIO:
${request.message}

INSTRUCCIONES:
- Responde basándote SOLO en los datos proporcionados
- Si no tienes información suficiente, dilo claramente
- Sé específico y usa números del contexto
- Sugiere acciones concretas cuando sea relevante
- Responde en español de forma profesional y directa`;

        try {
            const result = await model.generateContent(prompt);
            const response = result.response.text();

            this.logger.log('Chat response generated successfully');

            return {
                response,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Error in chat:', error);
            throw new Error('Failed to process chat message. Please try again.');
        }
    }

    clearCache(): void {
        this.insightsCache = null;
        this.logger.log('Insights cache cleared');
    }
}
