import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  /*app.enableCors({
    origin: 'http://localhost:58230', 
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
  });*/

  app.use((req, res, next) => {
    console.log(`📥 Recebido pedido: ${req.method} ${req.url}`);
    next();
  });

  app.enableCors({
    origin: [
      'http://localhost:50323',
      'http://localhost:58230',
      'http://localhost:62819/',
    ],
    methods: 'GET,POST,PUT,DELETE, OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
