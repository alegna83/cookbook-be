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
  const configuredOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
    : [];

  const defaultOrigins = [
    'https://stays4pilgrims-camino.web.app',
    'https://camino-places-app.web.app',
    'http://localhost:3000',
    'http://localhost:8080',
  ];

  const allowedOrigins = new Set(
    [...configuredOrigins, ...defaultOrigins].map((origin) =>
      origin.replace(/\/$/, ''),
    ),
  );

  if (shouldLogRequests) {
    console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('Allowed origins:', [...allowedOrigins]);
  }

  const devOrigins = [
    /^https?:\/\/localhost(?::\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = origin.replace(/\/$/, '');
      const isAllowed =
        allowedOrigins.has(normalizedOrigin) ||
        devOrigins.some((pattern) => pattern.test(normalizedOrigin));

      callback(isAllowed ? null : new Error(`CORS blocked for origin ${origin}`), isAllowed);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
