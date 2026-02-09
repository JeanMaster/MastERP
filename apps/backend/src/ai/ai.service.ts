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
        // Al iniciar el servicio, buscamos la API KEY de Gemini en las variables de entorno (.env)
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY no encontrada. Las funciones de IA estarán desactivadas.');
        } else {
            // Inicializamos el cliente de Google Generative AI
            const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
            this.logger.log(`Gemini AI inicializada con la clave: ${maskedKey}`);
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
    }

    // El "System Prompt" define la personalidad y las reglas que debe seguir la IA
    private readonly SYSTEM_PROMPT = `Eres un asesor financiero experto especializado en negocios retail en Venezuela.

Tu objetivo es analizar datos del negocio y generar recomendaciones ACCIONABLES y ESPECÍFICAS.

CONTEXTO VENEZOLANO Y MONEDA:
- Los datos financieros se te proporcionan NORMALIZADOS en DÓLARES (USD) para facilitar el análisis.
- El negocio opera en un entorno multimoneda (Bs y USD), pero tú debes reportar y recomendar basándote en los valores en USD proporcionados.
- Tienes acceso a Ventas, Inventario, Gastos Operativos y Compras de Mercancía del mes actual.
- Usa SIEMPRE el símbolo "$" o la palabra "USD" al mencionar montos.

CLARIDAD Y LENGUAJE:
- NO uses acrónimos técnicos como "MTD", "YTD" o "EBITDA".
- En su lugar, usa frases claras como "acumulado del mes", "en lo que va de mes" o "acumulado anual".
- Estilo directo, profesional y enfocado en acciones concretas que el dueño pueda tomar HOY.
- Prioriza rentabilidad y liquidez.`;

    /**
     * Genera análisis diarios (recomendaciones) basados en los datos del negocio.
     */
    async getDailyInsights(forceRefresh = false): Promise<AIInsightsResponse> {
        // 1. Verificamos si ya tenemos análisis recientes en "cache" para no gastar API (expira cada 24h)
        if (!forceRefresh && this.insightsCache && this.insightsCache.expiresAt > new Date()) {
            this.logger.log('Retornando análisis desde el cache');
            return this.insightsCache.data;
        }

        if (!this.genAI) {
            throw new Error('Gemini AI no inicializada. Verifica la variable GEMINI_API_KEY.');
        }

        this.logger.log('Generando nuevos análisis...');

        // 2. Obtenemos los datos actuales del negocio (ventas, inventario, etc.) desde el ContextBuilder
        const context = await this.contextBuilder.buildContext('today');
        const contextStr = JSON.stringify(context);
        this.logger.log(`Tamaño del contexto del negocio: ${contextStr.length} bytes`);

        // 3. Seleccionamos el modelo de Gemini (usamos flash-latest por ser rápido y eficiente)
        const model = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        // 4. Construimos el "prompt" final combinando las instrucciones y los datos reales
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
            // 5. Llamamos a Gemini para que procese el prompt
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            this.logger.log(`Respuesta raw de Gemini: ${responseText}`);

            // 6. Limpiamos la respuesta para asegurar que es un JSON válido (quitando comillas de markdown si existen)
            let cleanedText = responseText;
            const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
            if (jsonMatch && jsonMatch[1]) {
                cleanedText = jsonMatch[1].trim();
            } else {
                cleanedText = responseText
                    .replace(/```json\n?/g, '')
                    .replace(/```\n?/g, '')
                    .trim();
            }

            const parsed = JSON.parse(cleanedText);

            // 7. Creamos la respuesta final formateada
            const insights: AIInsightsResponse = {
                recommendations: parsed.recommendations || [],
                generatedAt: new Date().toISOString(),
                contextPeriod: context.period,
            };

            // 8. Guardamos en cache por 24 horas
            this.insightsCache = {
                data: insights,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            };

            this.logger.log(`Generadas ${insights.recommendations.length} recomendaciones`);
            return insights;
        } catch (error) {
            console.error('ERROR CRÍTICO EN IA:', error);

            // Manejo específico del error 429 (Límite de la versión gratuita alcanzado)
            if (error.status === 429 || error.message?.includes('429') || error.response?.status === 429) {
                this.logger.error('Límite de tasa de la API alcanzado (429)');
                throw new Error('La IA está ocupada debido al límite de uso gratuito. Por favor, espera 60 segundos e intenta de nuevo.');
            }

            this.logger.error('Error generando recomendaciones:', error);
            throw new Error('No se pudieron generar recomendaciones. Por favor, intenta de nuevo en unos momentos.');
        }
    }

    /**
     * Maneja la conversación interactiva (chat) con el usuario.
     */
    async chat(request: AIChatRequest): Promise<AIChatResponse> {
        if (!this.genAI) {
            throw new Error('Gemini AI no inicializada.');
        }

        this.logger.log('Procesando mensaje de chat...');

        // 1. Cargamos el contexto actual para que la IA sepa de qué negocio está hablando
        const context = await this.contextBuilder.buildContext('today');
        const model = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        // 2. Construimos el historial de la conversación previa (si existe)
        let conversationContext = '';
        if (request.conversationHistory && request.conversationHistory.length > 0) {
            conversationContext = request.conversationHistory
                .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
                .join('\n');
        }

        // 3. Prompt para el modo chat
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
            // 4. Llamada a Gemini para el chat
            const result = await model.generateContent(prompt);
            const response = result.response.text();

            this.logger.log('Respuesta de chat generada con éxito');

            return {
                response,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Error en chat:', error);

            if (error.status === 429 || error.message?.includes('429') || error.response?.status === 429) {
                this.logger.error('Límite de tasa de la API alcanzado (429)');
                throw new Error('La IA está ocupada debido al límite de uso gratuito. Por favor, espera un minuto e intenta de nuevo.');
            }

            throw new Error('No se pudo procesar el mensaje. Por favor, intenta de nuevo.');
        }
    }

    /**
     * Limpia el cache de análisis para forzar la generación de nuevos datos.
     */
    clearCache(): void {
        this.insightsCache = null;
        this.logger.log('Cache de análisis limpiado');
    }
}
