import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Filtro de excepciones global para debuguear errores 500 en producción
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  // CORS - Configuración Permisiva para LAN
  app.enableCors({
    origin: true, // Refleja el origen de la solicitud (Permite todo)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Validación global
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
    .setDescription(
      'API REST para el sistema ERP MastERP - Migración Web',
    )
    .setVersion('1.0')
    .addTag('health', 'Endpoints de salud del sistema')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Prefijo global para todas las rutas
  app.setGlobalPrefix('api');

  // Trust proxy for production (important for getting real IP and secure cookies behind Render/Vercel/Railway)
  if (process.env.NODE_ENV === 'production') {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
  }

  const port = process.env.PORT ?? 3000;
  // Escuchar en 0.0.0.0 para permitir acceso desde la red local o contenedores
  await app.listen(port, '0.0.0.0');

  if (process.env.NODE_ENV !== 'production') {
    console.log(`🚀 Backend running on port ${port}`);
    console.log(`🌐 Acceso local: http://localhost:${port}`);
    console.log(`🌐 Acceso en red: http://(tu-ip-local):${port}`);
    console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
