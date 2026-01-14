# 📦 TypeORM Migrations Guide

## ❓ Por que Migrações?

As migrações salvaguardam a **estrutura completa da base de dados** como código, evitando:
- ❌ Rollbacks inesperados
- ❌ Perda de alterações
- ❌ Inconsistências entre ambientes
- ❌ Precisar correr SQLs manualmente no PgAdmin

## 🚀 Como Usar

### 1. **Correr Migrações (Aplicar Alterações)**
```bash
npm run build
npm run migration:run
```
Isto vai executar todas as migrações pendentes na BD.

### 2. **Ver Migrações Executadas**
```bash
npm run build
npm run migration:show
```
Mostra quais migrações já foram aplicadas.

### 3. **Reverter Última Migração**
```bash
npm run build
npm run migration:revert
```
Desfaz a última migração executada.

### 4. **Criar Nova Migração Após Alterar Entities**
Quando adicionar novas colunas/relações às entities:

```bash
npm run build
npm run migration:generate -- src/migrations/NomeDescritivo
```

Exemplo:
```bash
npm run migration:generate -- src/migrations/AddNewFieldsToAccommodation
```

## 📋 Estrutura

```
src/
├── migrations/
│   ├── 1705250400000-AddAccountUserTypeAndPlacesColumns.ts
│   └── (outras migrações...)
├── database.datasource.ts          (Configuração TypeORM)
└── (entities e módulos)
```

## 🔄 Workflow Completo

1. **Alterar uma Entity**:
   ```typescript
   // src/accounts/account.entity.ts
   @Column({ default: 'user' })
   role: string;
   ```

2. **Gerar Migração**:
   ```bash
   npm run build
   npm run migration:generate -- src/migrations/AddRoleToAccount
   ```

3. **Revisar Migração** (em `src/migrations/TIMESTAMP-AddRoleToAccount.ts`)

4. **Correr Migração**:
   ```bash
   npm run build
   npm run migration:run
   ```

5. **Commit para Git** (com a entity e a migração)

## ⚠️ Regras Importantes

- ❌ **NUNCA** alterar manualmente na BD sem criar migração
- ❌ **NUNCA** usar `synchronize: true` em produção
- ✅ **SEMPRE** comitar migrações no Git
- ✅ **SEMPRE** correr migrações antes de fazer deploy

## 🛠️ Troubleshooting

### Erro: "Migrations table not found"
Primeira vez a correr? É normal! Cria a tabela automaticamente.

### Erro: "Migration already executed"
Se fez alterações manualmente, pode ser necessário:
1. Fazer rollback: `npm run migration:revert`
2. Correr de novo: `npm run migration:run`

### Erro de Tipo Script/Datasource
Certifique-se que:
1. Fez `npm run build` antes de correr migrações
2. O arquivo `src/database.datasource.ts` existe
3. A variável `DATABASE_URL` está no `.env`

## 📌 Exemplo: Alterar Coluna Existente

Se quiser alterar `userType` de 50 para 100 caracteres:

1. Atualize a Entity:
   ```typescript
   @Column({ type: 'varchar', length: 100, default: 'normal' })
   userType: 'normal' | 'admin';
   ```

2. Gere migração:
   ```bash
   npm run migration:generate -- src/migrations/UpdateUserTypeLength
   ```

3. Revise e corrija se necessário

4. Corra:
   ```bash
   npm run migration:run
   ```

## 📚 Migrações Atuais

### ✅ 1705250400000-AddAccountUserTypeAndPlacesColumns
- Adiciona `userType` à tabela `account`
- Adiciona `status`, `approvedAt`, `rejectionReason`, `account_id` à tabela `places`
- Adiciona `status`, `approvedAt`, `rejectionReason` à tabela `comments`

---

**Referência**: [TypeORM Migrations Docs](https://typeorm.io/migrations)
