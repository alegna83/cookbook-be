# 🔐 Sistema de Aprovação - Guia de Uso

## 📋 Alterações Realizadas

### 1. Account (Utilizadores)
- ✅ Campo `userType`: 'normal' | 'admin' (default: 'normal')
- Quando um utilizador se regista pela app, é criado com type 'normal'
- Apenas admins podem aprovar ou rejeitar

### 2. Accommodations (Alojamentos)
- ✅ Campo `status`: 'pending' | 'approved' | 'rejected' (default: 'pending')
- ✅ Campo `approvedAt`: data de aprovação
- ✅ Campo `rejectionReason`: motivo da rejeição
- ✅ Campo `account_id`: quem criou

### 3. Comments (Comentários)
- ✅ Campo `status`: 'pending' | 'approved' | 'rejected' (default: 'pending')
- ✅ Campo `approvedAt`: data de aprovação
- ✅ Campo `rejectionReason`: motivo da rejeição

---

## 🔧 Endpoints - Postman

### � ÚNICO ENDPOINT ADMIN (Encapsulado)

Todos os endpoints admin foram encapsulados num único ponto:

```
POST http://localhost:3000/auth/admin/handle
```

---

### 📍 ACCOMMODATIONS ADMIN

#### 1. Listar Accommodations Pendentes
```
POST http://localhost:3000/auth/admin/handle

Body:
{
  "action": "getPendingAccommodations"
}

Response: [
  {
    "id": 1,
    "place_name": "Albergue São João",
    "status": "pending",
    "account_id": 5,
    ...
  }
]
```

#### 2. Aprovar Accommodation
```
POST http://localhost:3000/auth/admin/handle

Body:
{
  "action": "approveAccommodation",
  "payload": {
    "id": 1
  }
}

Response: { 
  "id": 1,
  "status": "approved", 
  "approvedAt": "2026-01-09T..."
}
```

#### 3. Rejeitar Accommodation
```
POST http://localhost:3000/auth/admin/handle

Body:
{
  "action": "rejectAccommodation",
  "payload": {
    "id": 1,
    "rejectionReason": "Informação incompleta ou incorreta"
  }
}

Response: { 
  "id": 1,
  "status": "rejected", 
  "rejectionReason": "Informação incompleta ou incorreta"
}
```

---

### 💬 COMMENTS ADMIN

#### 1. Listar Comentários Pendentes
```
POST http://localhost:3000/auth/admin/handle

Body:
{
  "action": "getPendingComments"
}

Response: [
  {
    "id": 123,
    "placeId": 1,
    "accountId": 5,
    "comment": "Ótimo albergue!",
    "status": "pending",
    "createdAt": "2026-01-09..."
  }
]
```

#### 2. Aprovar Comentário
```
POST http://localhost:3000/auth/admin/handle

Body:
{
  "action": "approveComment",
  "payload": {
    "id": 123
  }
}

Response: { 
  "id": 123,
  "status": "approved", 
  "approvedAt": "2026-01-09T..."
}
```

#### 3. Rejeitar Comentário
```
POST http://localhost:3000/auth/admin/handle

Body:
{
  "action": "rejectComment",
  "payload": {
    "id": 123,
    "rejectionReason": "Conteúdo inapropriado"
  }
}

Response: { 
  "id": 123,
  "status": "rejected", 
  "rejectionReason": "Conteúdo inapropriado"
}
```

---

### 📍 ACCOMMODATIONS (Utilizadores Normais)

#### 1. Criar Accommodation (fica em pending)
```
POST http://localhost:3000/accommodations/handle

Body:
{
  "action": "create",
  "payload": {
    "place_name": "Albergue São João",
    "address": "Rua Principal, 123",
    "latitude": 42.8782,
    "longitude": -8.5448,
    "place_category": 1,
    "account_id": 5
  }
}

Response: status = "pending"
```

---

### 💬 COMMENTS (Utilizadores Normais)

#### 1. Adicionar Comentário (fica em pending)
```
POST http://localhost:3000/comments/handle

Body:
{
  "action": "add",
  "payload": {
    "placeId": 1,
    "accountId": 5,
    "rating": 4.5,
    "comment": "Ótimo albergue!"
  }
}

Response: { "status": "pending", "id": 123 }
```

---

## 🔒 Segurança

Para aplicar as alterações no PostgreSQL, execute:

```sql
-- Add userType to accounts
ALTER TABLE account ADD COLUMN "userType" varchar(50) DEFAULT 'normal';

-- Add status fields to places (accommodations)
ALTER TABLE places ADD COLUMN status varchar(50) DEFAULT 'pending';
ALTER TABLE places ADD COLUMN "approvedAt" timestamp NULL;
ALTER TABLE places ADD COLUMN "rejectionReason" varchar(500) NULL;
ALTER TABLE places ADD COLUMN account_id int NULL;

-- Add status fields to comments
ALTER TABLE comments ADD COLUMN status varchar(50) DEFAULT 'pending';
ALTER TABLE comments ADD COLUMN "approvedAt" timestamp NULL;
ALTER TABLE comments ADD COLUMN "rejectionReason" varchar(500) NULL;
```

---

## ⚙️ Fluxo de Aprovação

```
1. Utilizador cria Accommodation/Comment
   ↓
   Status = "pending"
   
2. Admin vê no endpoint GET /admin/pending
   ↓
   
3. Admin aprova ou rejeita via PATCH /admin/:id/approve
   ↓
   
4. Status muda para "approved" ou "rejected"
   ↓
   
5. Frontend mostra apenas "approved" para utilizadores normais
```

---

## 💡 Notas Importantes
� Segurança

O endpoint `/auth/admin/handle` deve ter validação de:
- ✅ Token JWT válido
- ✅ `userType === 'admin'` no token payload
- ❌ Utilizadores normais não podem aceder

---

## �
- Apenas os endpoints `/admin/*` são para administradores
- Adiciona validação de `userType === 'admin'` no frontend/backend
- Os comentários/accommodations em "pending" não devem aparecer no feed público
- Considera adicionar um endpoint para users verem o status dos seus submissions
✅ **Encapsulado**: Um único endpoint `/auth/admin/handle` para todas as ações admin
- ✅ **Oculto**: Não expõe estrutura interna (pending, approve, etc.)
- ✅ **Seguro**: Valida userType antes de executar ações
- Os comentários/accommodations em "pending" não devem aparecer no feed público
- Considera adicionar um endpoint para users verem o status dos seus submissions

---

## 📋 Actions Disponíveis

| Action | Descrição |
|--------|-----------|
| `getPendingAccommodations` | Lista alojamentos pendentes |
| `getPendingComments` | Lista comentários pendentes |
| `approveAccommodation` | Aprova um alojamento |
| `rejectAccommodation` | Rejeita um alojamento |
| `approveComment` | Aprova um comentário |
| `rejectComment` | Rejeita um comentário |