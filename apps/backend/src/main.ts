import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global exception filter for debugging 500 errors in production
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  // CORS - Permissive configuration for LAN access
  app.enableCors({
    origin: true, // Reflects the request origin (allows all)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger/OpenAPI
  const config = new DocumentBuilder()
    .setTitle('MastERP API')
    .setDescription('REST API for the MastERP ERP System')
    .setVersion('1.0')
    .addTag('health', 'System health endpoints')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Global route prefix for all endpoints
  app.setGlobalPrefix('api');

  // Trust proxy for production (important for getting real IP and secure cookies behind Render/Vercel/Railway)
  if (process.env.NODE_ENV === 'production') {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
  }

  const port = process.env.PORT ?? 3000;
  // Listen on 0.0.0.0 to allow access from the local network or containers
  await app.listen(port, '0.0.0.0');

  if (process.env.NODE_ENV !== 'production') {
    console.log(`🚀 Backend running on port ${port}`);
    console.log(`🌐 Local access: http://localhost:${port}`);
    console.log(`🌐 Network access: http://(your-local-ip):${port}`);
    console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
