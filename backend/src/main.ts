import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { existsSync } from 'fs';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    throw new Error('JWT_SECRET must be set to a random string of at least 16 characters');
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
    credentials: false,
  });

  // Uploaded images and downloadable files
  app.use(
    '/uploads',
    (_req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    },
    express.static(join(process.cwd(), 'uploads')),
  );

  // Serve the built React app from the same server when it exists
  const dist = join(process.cwd(), '..', 'frontend', 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile(join(dist, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 5000;
  await app.listen(port);
  console.log(`Portfolio API on http://localhost:${port}/api`);
}
bootstrap();
