# MCP PostgreSQL (MVP) para este projeto

Este setup foi pensado para ser simples e seguro.

## Objetivo

Evitar regressões de schema como:
- `column places.status does not exist`
- `column Account.userType does not exist`

## 1) Comando único de diagnóstico

Já tens um comando pronto no projeto:

```bash
npm run db:health
```

Ele valida automaticamente:
- colunas críticas (`account.userType`, `places.status`, `comments.status`, etc.)
- migrations críticas de reparação
- valores inválidos de `status`
- valores inválidos de `userType`

Se algo estiver errado, o comando falha com `exit code 1`.

## 2) Como encaixa no MCP

Com MCP PostgreSQL, em vez de executares SQL manual, pedes ao assistente para correr checks no servidor MCP.

Prompts úteis:
- "Valida schema crítico (`account`, `places`, `comments`)"
- "Mostra migrations executadas e pendentes"
- "Confirma que `places.status` e `comments.status` não têm valores inválidos"
- "Executa os checks do `db:health` e resume erros"

## 3) Workflow recomendado (simples)

- Antes de deploy: `npm run db:health`
- Depois de deploy: `npm run db:health`
- Se falhar: correr migrations e voltar a validar

## 4) Segurança

- Mantém o MCP de BD em modo read-only por defeito.
- Usa credenciais separadas por ambiente (dev/staging/prod).
- Nunca commitar ficheiros `.env*` com segredos.
