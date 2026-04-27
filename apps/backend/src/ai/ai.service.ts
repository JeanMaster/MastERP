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

  /**
   * Returns a configured GoogleGenerativeAI client using the API key from DB or environment.
   */
  private async getGenAIClient(): Promise<GoogleGenerativeAI> {
    const config = await this.prisma.aIConfig.findFirst({
      where: { provider: 'gemini', isActive: true },
    });
    const apiKey = config?.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Gemini AI is not configured. Please enter your API Key in the system general settings.',
      );
    }

    return new GoogleGenerativeAI(apiKey);
  }

  /**
   * Retrieves the current AI configuration (Gemini). Creates a default one if none exists.
   */
  async getConfig() {
    let config = await this.prisma.aIConfig.findFirst({
      where: { provider: 'gemini' },
    });

    if (!config) {
      // Create a default configuration
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

  /**
   * Updates the AI configuration.
   * @param data The new configuration data.
   */
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

  /**
   * System prompt that defines the AI's role as a business diagnostician.
   * The AI diagnoses current business health but does NOT give action recommendations.
   */
  private readonly SYSTEM_PROMPT = `You are an expert Business Diagnostic Analyst specialized in retail for the Venezuelan market.

Your objective is to perform a GENERAL DIAGNOSIS of the current store situation based on the provided data.

CRITICAL RULES:
1. Do NOT give recommendations or action suggestions (your task is to diagnose, not advise).
2. IGNORE the "Cash" or "Immediate Liquidity" data entirely. The user does not want this factor to cloud the structural health analysis.
3. FOCUS exclusively on:
   - Sales Analysis: Comparatives, trends, and projections based on history.
   - Financial Balance: The structural relationship between Accounts Receivable, Accounts Payable, Expenses, and Merchandise Purchases.
4. LANGUAGE:
   - Be direct, analytical, and objective.
   - Use USD amounts whenever discussing money.
   - Structure your diagnosis in three axes: Executive Summary, Sales Analysis, and Balance Situation.`;

  /**
   * Marketing prompt that defines the AI's role as a social media copywriter.
   */
  private readonly MARKETING_PROMPT = `You are an expert in Digital Marketing and creative Copywriting for retail businesses.
Your goal is to generate captivating, persuasive, and optimized copy for social media (Instagram, WhatsApp, Facebook, TikTok).

STYLE RULES:
- Use emojis strategically to give personality to the text.
- Structure the copy with hooks at the beginning and calls to action (CTA) at the end.
- For Instagram: Use relevant hashtags at the end.
- For WhatsApp: Be more direct and personal.
- For TikTok: Suggest a brief video idea or a very short and dynamic text.
- Always maintain a human, close, and exciting tone.
- If a price is provided, mention it attractively.`;

  /**
   * Generates daily AI insights (business diagnosis) based on current business data.
   * Caches results for 24 hours to avoid unnecessary API calls.
   * @param forceRefresh Whether to bypass the cache and regenerate.
   * @returns An AIInsightsResponse with the diagnosis.
   */
  async getDailyInsights(forceRefresh = false): Promise<AIInsightsResponse> {
    // 1. Return cached insights if still valid (expires every 24h)
    if (
      !forceRefresh &&
      this.insightsCache &&
      this.insightsCache.expiresAt > new Date()
    ) {
      this.logger.log('Returning insights from cache');
      return this.insightsCache.data;
    }

    this.logger.log('Generating new insights...');

    const genAI = await this.getGenAIClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
    });

    // 2. Build business context (sales, inventory, etc.) from the ContextBuilder
    const context = await this.contextBuilder.buildContext('today');
    const contextStr = JSON.stringify(context);
    this.logger.log(
      `Business context size: ${contextStr.length} bytes`,
    );

    // 3. Build the final prompt combining instructions and real data
    const prompt = `${this.SYSTEM_PROMPT}

BUSINESS DATA (Ignore finances.cashBalance):
${JSON.stringify(context, null, 2)}

TASK:
Perform a comprehensive diagnosis of the business health based on the sales history and the debt/expense structure.

RESPONSE FORMAT (strict JSON):
{
  "diagnosis": {
    "summary": "Executive summary of the overall state",
    "salesAnalysis": "Deep narrative analysis of sales (trend, top products, comparatives)",
    "financialBalance": "Structural analysis of the AR vs AP vs Expenses vs Purchases relationship",
    "overallStatus": "healthy" | "warning" | "critical"
  }
}

IMPORTANT: Respond ONLY with the JSON, no additional text.`;

    try {
      // 4. Call Gemini to process the prompt
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      this.logger.log(`Gemini raw response: ${responseText}`);

      // 5. Clean the response to ensure valid JSON (remove markdown code fences if present)
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

      // 6. Format the final response
      const insights: AIInsightsResponse = {
        diagnosis: parsed.diagnosis,
        recommendations: [], // The new diagnosis format does not use individual recommendations
        generatedAt: new Date().toISOString(),
        contextPeriod: context.period,
      };

      // 7. Cache for 24 hours
      this.insightsCache = {
        data: insights,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      this.logger.log('Diagnosis generated successfully');
      return insights;
    } catch (error) {
      console.error('CRITICAL AI ERROR:', error);

      // Handle 429 rate limit error
      if (
        error.status === 429 ||
        error.message?.includes('429') ||
        error.response?.status === 429
      ) {
        this.logger.error('API rate limit reached (429)');
        throw new Error(
          'The AI is busy due to the free usage limit. Please wait 60 seconds and try again.',
        );
      }

      this.logger.error('Error generating insights:', error);
      throw new Error(
        'Could not generate insights. Please try again in a few moments.',
      );
    }
  }

  /**
   * Handles an interactive chat request with the AI assistant.
   * Passes the current business context and conversation history to the model.
   * @param request The chat request including message and history.
   * @returns An AIChatResponse with the AI's reply.
   */
  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    this.logger.log('Processing chat message...');

    const genAI = await this.getGenAIClient();
    const context = await this.contextBuilder.buildContext('today');
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
    });

    // Build the prior conversation history context
    let conversationContext = '';
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      conversationContext = request.conversationHistory
        .map(
          (msg) =>
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`,
        )
        .join('\n');
    }

    const prompt = `${this.SYSTEM_PROMPT}

CURRENT BUSINESS DATA:
${JSON.stringify(context, null, 2)}

${conversationContext ? `CONVERSATION HISTORY:\n${conversationContext}\n` : ''}

USER QUESTION:
${request.message}

INSTRUCTIONS:
- Answer based ONLY on the provided data
- If you don't have enough information, state it clearly
- Be specific and use numbers from the context
- Suggest concrete actions when relevant
- Respond professionally and directly`;

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

      if (
        error.status === 429 ||
        error.message?.includes('429') ||
        error.response?.status === 429
      ) {
        this.logger.error('API rate limit reached (429)');
        throw new Error(
          'The AI is busy due to the free usage limit. Please wait a minute and try again.',
        );
      }

      throw new Error(
        'Could not process the message. Please try again.',
      );
    }
  }

  /**
   * Clears the insights cache to force regeneration of data on the next call.
   */
  clearCache(): void {
    this.insightsCache = null;
    this.logger.log('Insights cache cleared');
  }

  /**
   * Generates a social media post based on a product's data.
   * @param data Product data, target platform, and optional custom instructions.
   * @returns The generated post text.
   */
  async generateSocialPost(data: {
    product: any;
    platform: string;
    customInstructions?: string;
  }): Promise<string> {
    const genAI = await this.getGenAIClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `${this.MARKETING_PROMPT}

PRODUCT DATA:
${JSON.stringify(data.product, null, 2)}

PLATFORM: ${data.platform}
ADDITIONAL INSTRUCTIONS: ${data.customInstructions || 'None'}

TASK: Generate a creative post for this product optimized for the specified platform.
Include hooks, an attractive description, price (if available in the data), and hashtags.`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      this.logger.error('Error generating social post:', error);
      throw new Error('Could not generate the post. Please try again.');
    }
  }
}
