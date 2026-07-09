# Comandos do Projeto

Guia rápido dos comandos mais úteis do backend NestJS.

## Desenvolvimento

- `npm run start:dev` - arranca o servidor em modo watch.
- `npm run start` - arranca o servidor em modo normal.
- `npm run build` - compila o projeto TypeScript para `dist/`.
- `npm run start:prod` - arranca a aplicação a partir da build gerada.

## Qualidade de código

- `npm run lint` - executa ESLint com `--fix`.
- `npm run format` - formata os ficheiros TypeScript com Prettier.

## Testes unitários

- `npm test` - corre todos os testes unitários (`*.spec.ts`).
- `npm run test:watch` - corre os testes unitários em modo watch.
- `npm run test:cov` - corre os testes unitários com cobertura.

## Testes de integração

- `npm run test:integration:auth-comments` - corre a integração HTTP de auth e comments.
- `npm run test:integration:upload-suggestions` - corre a integração HTTP de upload e suggestions.
- `npm run test:integration` - corre as duas suites de integração em sequência.

## Testes end-to-end

- `npm run test:e2e` - corre os testes E2E configurados em `test/jest-e2e.json`.

## Base de dados

- `npm run migration:generate` - gera uma migration TypeORM.
- `npm run migration:create` - cria uma migration vazia.
- `npm run migration:run` - compila o projeto e executa migrations.
- `npm run migration:run:prod` - executa migrations sem compilar primeiro.
- `npm run migration:revert` - reverte a última migration.
- `npm run migration:show` - lista as migrations pendentes/aplicadas.
- `npm run db:health` - executa o healthcheck da base de dados.

## Notas

- Se quiseres correr apenas um teste específico, podes usar `npx jest --runInBand <ficheiro.spec.ts>`.
- Os testes de integração usam runners dedicados em `scripts/` para melhor controlo e estrutura.
