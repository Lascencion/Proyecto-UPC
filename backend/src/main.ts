import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', 'http://localhost:4200').split(',') });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: 'Hay campos con errores.',
          errors: errors.map((e) => ({ field: e.property, message: Object.values(e.constraints ?? {}).join(' ') })),
        }),
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Sistema de generación de casos de prueba - API')
    .setDescription('Módulo 1: Base de conocimiento (requerimientos, reglas de negocio, casos de prueba y defectos).')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  await app.listen(config.get<number>('PORT', 3000));
}
bootstrap();
