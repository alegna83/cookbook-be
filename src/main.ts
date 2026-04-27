import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';
  const shouldLogRequests =
    process.env.HTTP_REQUEST_LOGS === 'true' || !isProduction;

  //app.enableCors();

  /*app.enableCors({
    origin: 'http://localhost:58230', 
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
  });*/

  // Compress JSON payloads to reduce transfer time in production networks.
  app.use(compression());

  if (shouldLogRequests) {
    app.use((req, res, next) => {
      console.log(`📥 Recebido pedido: ${req.method} ${req.url}`);
      next();
    });
  }

  /*app.enableCors({
    origin: [
      'http://localhost:50323',
      'http://localhost:58230',
      'http://localhost:62819/',
      'https://camino-places-app.web.app/'
    ],
    methods: 'GET,POST,PUT,DELETE, OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });*/
  if (shouldLogRequests) {
    console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('Allowed origins:', process.env.FRONTEND_URL?.split(','));
  }

  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: allowedOrigins, //process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
