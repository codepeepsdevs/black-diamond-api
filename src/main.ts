import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.setGlobalPrefix('api');
  // app.useGlobalPipes(new ValidationPipe());

  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      whitelist: true,
      transform: true,
    }),
  );

  app.use(cookieParser());

  const devOrigin =
    process.env.NODE_ENV === 'development'
      ? [
          'http://localhost:3000',
          'http://localhost:3001',
          'https://zvp3vrxl-3000.eun1.devtunnels.ms',
          'https://10.61.115.232:3443',
        ]
      : [];
  app.enableCors({
    origin: [
      ...devOrigin,
      'https://www.eventsbyblackdiamond.com',
      'https://eventsbyblackdiamond.com',
      'https://black-diamond-client-dev.vercel.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['set-cookie'],
    credentials: true,
  });

  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');

  await app.listen(process.env.PORT || 5000);
}
bootstrap();

// import { ValidationPipe } from '@nestjs/common';
// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
// // import * as session from 'express-session';
// // import * as passport from 'passport';
// import * as cookieParser from 'cookie-parser';
// import { NestExpressApplication } from '@nestjs/platform-express';

// async function bootstrap() {
//   const app = await NestFactory.create<NestExpressApplication>(AppModule, {
//     rawBody: true,
//   });
//   app.setGlobalPrefix('api');
//   app.useGlobalPipes(
//     new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }),
//   );

//   // app.useLogger(app.get(Logger));

//   app.use(cookieParser());
//   // app.useStaticAssets(join(__dirname, '..', 'static'));

//   app.enableCors({
//     origin: [
//       'http://localhost:3000',
//       'http://localhost:3001',
//       'https://blackdiamond-client.vercel.app',
//     ],
//     methods: ['GET', 'POST', 'PUT', 'DELETE'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
//     exposedHeaders: ['set-cookie'],
//     credentials: true,
//   });

//   const config = new DocumentBuilder()
//     .setTitle('BlackDiamond Blockchain Api')
//     .setDescription('Read from and write to the database, using api end points')
//     .setVersion('1.0')
//     .addServer('http://localhost:5000/', 'Local environment')
//     .addServer('https://staging.yourapi.com/', 'Staging')
//     .addServer('https://production.yourapi.com/', 'Production')
//     .build();

//   const document = SwaggerModule.createDocument(app, config);
//   SwaggerModule.setup('docs', app, document);

//   await app.listen(5000);
// }
// bootstrap();
