import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ContextBuilderService } from './context-builder.service';
import { PrismaService } from '../prisma/prisma.service';
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
  private insightsCache: { data: AIInsightsResponse; expiresAt: Date } | null =
    null;

  constructor(
    private contextBuilder: ContextBuilderService,
    private prisma: PrismaService
  ) {}

  private async getGenAIClient(): Promise<GoogleGenerativeAI> {
    const config = await this.prisma.aIConfig.findFirst({
      where: { provider: 'gemini', isActive: true },
    });
    const apiKey = config?.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Gemini AI no configurada. Por favor, ingresa tu API Key en la configuración general del sistema.',
      );
    }

    return new GoogleGenerativeAI(apiKey);
  }

  async getConfig() {
    // Retornamos la configuración de Gemini por defecto
    let config = await this.prisma.aIConfig.findFirst({
      where: { provider: 'gemini' },
    });

    if (!config) {
      // Si no existe, creamos una por defecto
      config = await this.prisma.aIConfig.create({
        data: {
          provider: 'gemini',
          modelName: 'gemini-1.5-flash',
          isActive: true,
        },
      });
    }

    return config;
  }

  async updateConfig(data: any) {
    const current = await this.getConfig();
    return this.prisma.aIConfig.update({
      where: { id: current.id },
      data: {
        apiKey: data.apiKey,
        modelName: data.modelName || 'gemini-1.5-flash',
        isActive: data.isActive !== undefined ? data.isActive : true,
        settings: data.settings || {},
      },
    });
  }

  // El "System Prompt" define la personalidad y las reglas que debe seguir la IA
  private readonly SYSTEM_PROMPT = `Eres un Analista de Diagnóstico de Negocios experto en retail para el mercado venezolano.
  
Tu objetivo es realizar un DIAGNÓSTICO GENERAL de la situación actual de la tienda basándote en los datos proporcionados.

REGLAS CRÍTICAS:
1. NO des recomendaciones o sugerencias de acción (tu tarea es diagnosticar, no asesorar).
2. IGNORA completamente el dato de "Caja" o "Liquidez Inmediata". El usuario no desea que este factor nuble el análisis de salud estructural.
3. ENFÓCATE exclusivamente en:
   - Análisis de Ventas: Comparativas, tendencias y proyecciones basadas en historial.
   - Balance Financiero: La relación estructural entre Cuentas por Cobrar, Cuentas por Pagar, Gastos y Compras de Mercancía.
4. LENGUAJE:
   - Sé directo, analítico y objetivo.
   - Usa montos en USD siempre que hables de dinero.
   - Estructura tu diagnóstico en tres ejes: Resumen Ejecutivo, Análisis de Ventas y Situación de Balance.`;

  private readonly MARKETING_PROMPT = `Eres un experto en Marketing Digital y Copywriting creativo para negocios retail.
Tu objetivo es generar copys cautivadores, persuasivos y optimizados para redes sociales (Instagram, WhatsApp, Facebook, TikTok).

REGLAS DE ESTILO:
- Usa emojis de forma estratégica para dar personalidad al texto.
- Estructura el copy con ganchos (hooks) al inicio y llamadas a la acción (CTA) al final.
- Para Instagram: Usa hashtags relevantes al final.
- Para WhatsApp: Sé más directo y personal.
- Para TikTok: Sugiere una idea breve de video o un texto muy corto y dinámico.
- Siempre mantén un tono humano, cercano y emocionante.
- Si se proporciona un precio, menciónalo de forma atractiva.`;

  /**
   * Genera análisis diarios (recomendaciones) basados en los datos del negocio.
   */
  async getDailyInsights(forceRefresh = false): Promise<AIInsightsResponse> {
    // 1. Verificamos si ya tenemos análisis recientes en "cache" para no gastar API (expira cada 24h)
    if (
      !forceRefresh &&
      this.insightsCache &&
      this.insightsCache.expiresAt > new Date()
    ) {
      this.logger.log('Retornando análisis desde el cache');
      return this.insightsCache.data;
    }

    this.logger.log('Generando nuevos análisis...');

    const genAI = await this.getGenAIClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
    });

    // 2. Obtenemos los datos actuales del negocio (ventas, inventario, etc.) desde el ContextBuilder
    const context = await this.contextBuilder.buildContext('today');
    const contextStr = JSON.stringify(context);
    this.logger.log(
      `Tamaño del contexto del negocio: ${contextStr.length} bytes`,
    );

    // 3. Seleccionamos el modelo de Gemini (usamos flash-latest por ser rápido y eficiente)
    // model already defined above

    // 4. Construimos el "prompt" final combinando las instrucciones y los datos reales
    const prompt = `${this.SYSTEM_PROMPT}

DATOS DEL NEGOCIO (Ignorar finances.cashBalance):
${JSON.stringify(context, null, 2)}

TAREA:
Realiza un diagnóstico integral de la salud del negocio basándote en el historial de ventas y la estructura de deudas/gastos. 

FORMATO DE RESPUESTA (JSON estricto):
{
  "diagnosis": {
    "summary": "Resumen ejecutivo del estado general",
    "salesAnalysis": "Análisis narrativo profundo de las ventas (tendencia, productos top, comparativa)",
    "financialBalance": "Análisis estructural de la relación CxC vs CxP vs Gastos vs Compras",
    "overallStatus": "healthy" | "warning" | "critical"
  }
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
        diagnosis: parsed.diagnosis,
        generatedAt: new Date().toISOString(),
        contextPeriod: context.period,
      };

      // 8. Guardamos en cache por 24 horas
      this.insightsCache = {
        data: insights,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      this.logger.log(
        `Diagnóstico generado con éxito`,
      );
      return insights;
    } catch (error) {
      console.error('ERROR CRÍTICO EN IA:', error);

      // Manejo específico del error 429 (Límite de la versión gratuita alcanzado)
      if (
        error.status === 429 ||
        error.message?.includes('429') ||
        error.response?.status === 429
      ) {
        this.logger.error('Límite de tasa de la API alcanzado (429)');
        throw new Error(
          'La IA está ocupada debido al límite de uso gratuito. Por favor, espera 60 segundos e intenta de nuevo.',
        );
      }

      this.logger.error('Error generando recomendaciones:', error);
      throw new Error(
        'No se pudieron generar recomendaciones. Por favor, intenta de nuevo en unos momentos.',
      );
    }
  }

  /**
   * Maneja la conversación interactiva (chat) con el usuario.
   */
  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    this.logger.log('Procesando mensaje de chat...');

    const genAI = await this.getGenAIClient();
    const context = await this.contextBuilder.buildContext('today');
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
    });

    // 2. Construimos el historial de la conversación previa (si existe)
    let conversationContext = '';
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      conversationContext = request.conversationHistory
        .map(
          (msg) =>
            `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`,
        )
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

      if (
        error.status === 429 ||
        error.message?.includes('429') ||
        error.response?.status === 429
      ) {
        this.logger.error('Límite de tasa de la API alcanzado (429)');
        throw new Error(
          'La IA está ocupada debido al límite de uso gratuito. Por favor, espera un minuto e intenta de nuevo.',
        );
      }

      throw new Error(
        'No se pudo procesar el mensaje. Por favor, intenta de nuevo.',
      );
    }
  }

  /**
   * Limpia el cache de análisis para forzar la generación de nuevos datos.
   */
  clearCache(): void {
    this.logger.log('Cache de análisis limpiado');
  }

  /**
   * Genera un post para redes sociales basado en datos de un producto
   */
  async generateSocialPost(data: {
    product: any;
    platform: string;
    customInstructions?: string;
  }): Promise<string> {
    const genAI = await this.getGenAIClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `${this.MARKETING_PROMPT}

DATOS DEL PRODUCTO:
${JSON.stringify(data.product, null, 2)}

PLATAFORMA: ${data.platform}
INSTRUCCIONES ADICIONALES: ${data.customInstructions || 'Ninguna'}

TAREA: Genera un post creativo para este producto optimizado para la plataforma indicada. 
Incluye ganchos, descripción atractiva, precio (si está en los datos) y hashtags.`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      this.logger.error('Error generando post social:', error);
      throw new Error('No se pudo generar el post. Intenta de nuevo.');
    }
  }
}
