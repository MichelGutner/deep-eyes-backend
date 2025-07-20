# Prisma + TimescaleDB Setup

Este projeto usa uma arquitetura híbrida para observabilidade:

- **📊 PostgreSQL/TimescaleDB** → Métricas e traces estruturados
- **📝 Elasticsearch** → Logs e busca textual
- **🔍 Redis** → Cache e sessões
- **📈 OpenTelemetry** → Coleta de dados

## 🚀 Configuração Rápida

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variável de ambiente
Certifique-se de que `DATABASE_URL` está configurada no seu `.env`:
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/deep_eyes"
```

### 3. Executar setup completo
```bash
npm run db:setup
```

Este comando irá:
- ✅ Executar migração do Prisma
- ✅ Gerar cliente Prisma
- ✅ Configurar hypertables do TimescaleDB
- ✅ Criar políticas de compressão e retenção
- ✅ Configurar continuous aggregates

## 📊 Estrutura dos Schemas

### **Tabelas de Time-Series (Hypertables)**
- **`metrics`** - Métricas com valores numéricos e timestamp
- **`traces`** - Spans de distributed tracing com startTime

### **Tabelas Regulares**
- **`applications`** - Aplicações/serviços monitorados
- **`alerts`** - Alertas e notificações
- **`users`** - Usuários do sistema

### **📝 Logs (Elasticsearch)**
Os logs são armazenados no Elasticsearch para:
- Busca textual avançada
- Análise de texto completo
- Agregações complexas
- Retenção flexível

## 🔧 Comandos Úteis

```bash
# Migração do banco
npm run db:migrate

# Gerar cliente Prisma
npm run db:generate

# Abrir Prisma Studio
npm run db:studio

# Setup completo com TimescaleDB
npm run db:setup
```

## ⏰ Recursos do TimescaleDB

### **Hypertables**
- `metrics` - Particionamento por timestamp
- `traces` - Particionamento por startTime

### **Compressão Automática**
- Métricas: 30 dias
- Traces: 7 dias

### **Retenção de Dados**
- Métricas: 365 dias
- Traces: 30 dias

### **Continuous Aggregates**
- `metrics_hourly` - Agregação horária de métricas
- `metrics_daily` - Agregação diária de métricas

## 📈 Exemplos de Queries

### Métricas das últimas 24h
```sql
SELECT * FROM metrics 
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

### Métricas por hora
```sql
SELECT * FROM metrics_hourly 
WHERE bucket > NOW() - INTERVAL '7 days'
ORDER BY bucket DESC;
```

### Traces de uma aplicação
```sql
SELECT * FROM traces 
WHERE applicationId = 'app-id'
  AND startTime > NOW() - INTERVAL '1 hour'
ORDER BY startTime DESC;
```

### Alertas ativos
```sql
SELECT * FROM alerts 
WHERE status = 'ACTIVE'
ORDER BY severity DESC, createdAt DESC;
```

## 🏗️ Arquitetura Completa

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │   Application   │    │   Application   │
│   (NestJS)      │    │   (NestJS)      │    │   (NestJS)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │  Elasticsearch  │    │      Redis      │
│  TimescaleDB    │    │                 │    │                 │
│                 │    │                 │    │                 │
│ • Metrics       │    │ • Logs          │    │ • Cache         │
│ • Traces        │    │ • Text Search   │    │ • Sessions      │
│ • Alerts        │    │ • Aggregations  │    │ • Rate Limiting │
│ • Users         │    │ • Full-Text     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Desenvolvimento

### Adicionar nova migração
```bash
npx prisma migrate dev --name add_new_field
```

### Reset do banco
```bash
npx prisma migrate reset
```

### Verificar schema
```bash
npx prisma validate
```

## 🔍 Monitoramento

### Verificar hypertables
```sql
SELECT * FROM timescaledb_information.hypertables;
```

### Verificar políticas
```sql
SELECT * FROM timescaledb_information.compression_settings;
SELECT * FROM timescaledb_information.retention_policies;
```

### Verificar continuous aggregates
```sql
SELECT * FROM timescaledb_information.continuous_aggregates;
``` 