# Deep Eyes Dashboard - Arquitetura Completa

## 📋 Visão Geral

O **Deep Eyes Dashboard** é uma plataforma moderna de observabilidade, monitoramento e análise de dados em tempo real. A arquitetura é modular, escalável e otimizada para performance, análise e segurança.

---

## 🏗️ Arquitetura Geral

```mermaid
graph TB
    subgraph "Frontend"
        FE[React + TypeScript + Vite]
    end
    
    subgraph "Backend"
        BE[NestJS + TypeScript]
        WS[WebSocket Gateway]
    end
    
    subgraph "Bancos de Dados"
        PG[(PostgreSQL + TimescaleDB)]
        REDIS[(Redis)]
        ES[(Elasticsearch)]
    end
    
    subgraph "Filas"
        BULL[Bull + Redis]
    end
    
    subgraph "Serviços Externos"
        OTEL[OpenTelemetry Collector]
    end
    
    FE -->|REST API| BE
    FE -->|WebSocket| WS
    BE -->|ORM| PG
    BE -->|Cache| REDIS
    BE -->|Logs| ES
    BE -->|Jobs| BULL
    BE -->|Telemetry| OTEL
    OTEL -->|Metrics/Logs/Traces| FE
    ES -->|Logs| FE
    PG -->|Data| FE
```

---

## 🛠️ Stack Tecnológica

### **Backend**
- **NestJS** + **TypeScript**
- **Prisma** (ORM)
- **Bull** (Filas)
- **JWT** (Autenticação)
- **Swagger** (Documentação)
- **Class Validator** (Validação)
- **OpenTelemetry** (Instrumentação)
- **Machine Learning** (Módulo integrado)

### **Bancos de Dados**
- **PostgreSQL** + **TimescaleDB** (Dados principais)
- **Redis** (Cache + Filas)
- **Elasticsearch** (Logs + Busca)

### **DevOps**
- **Docker** + **Docker Compose**
- **GitHub Actions** (CI/CD)
- **OpenTelemetry** (Observabilidade)

---

## 🗄️ Arquitetura de Bancos de Dados

### **1. PostgreSQL + TimescaleDB**

#### **Função Principal**
- Dados estruturados e relacionamentos
- Séries temporais (métricas, performance)
- Dados de usuários e configurações

#### **Tabelas Principais**
```sql
-- Usuários e Autenticação
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role USER_ROLE DEFAULT 'USER',
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizações (Multi-tenant)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) DEFAULT 'FREE',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboards
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id),
  layout JSONB NOT NULL,
  widgets JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alertas
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(100) NOT NULL,
  severity ALERT_SEVERITY NOT NULL,
  status ALERT_STATUS DEFAULT 'ACTIVE',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Métricas do Sistema (TimescaleDB)
CREATE TABLE system_metrics (
  time TIMESTAMPTZ NOT NULL,
  service_id UUID NOT NULL,
  cpu_percent DOUBLE PRECISION,
  memory_percent DOUBLE PRECISION,
  disk_percent DOUBLE PRECISION,
  network_io DOUBLE PRECISION,
  PRIMARY KEY (time, service_id)
);

-- Modelos de Machine Learning
CREATE TABLE ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  algorithm VARCHAR(100) NOT NULL,
  parameters JSONB DEFAULT '{}',
  accuracy DOUBLE PRECISION,
  status VARCHAR(20) DEFAULT 'training',
  model_data BYTEA,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resultados de ML
CREATE TABLE ml_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES ml_models(id),
  input_data JSONB,
  output_data JSONB,
  confidence DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar TimescaleDB
SELECT create_hypertable('system_metrics', 'time');
```

### **2. Redis**

#### **Função Principal**
- Cache de dados em tempo real
- Sessões de usuário
- Filas de processamento (Bull)

#### **Estruturas de Dados**
```redis
# Cache de métricas em tempo real
SET metrics:realtime:service:123 '{"cpu": 45, "memory": 72, "timestamp": "2024-01-15T10:30:00Z"}'

# Sessões de usuário
SET session:user:456 '{"user_id": "456", "permissions": ["read", "write"], "expires": 3600}'

# Filas de alertas
LPUSH alerts:critical '{"type": "high_cpu", "service": "api-gateway", "timestamp": "2024-01-15T10:30:00Z"}'

# Dados em tempo real
PUBLISH realtime:events '{"type": "user_login", "user_id": "123", "timestamp": "2024-01-15T10:30:00Z"}'
```

### **3. Elasticsearch**

#### **Função Principal**
- Logs de aplicação e erros
- Busca full-text
- Análise de logs

#### **Índices**
```json
{
  "index": "logs",
  "mapping": {
    "properties": {
      "timestamp": {"type": "date"},
      "level": {"type": "keyword"},
      "service": {"type": "keyword"},
      "message": {"type": "text"},
      "trace_id": {"type": "keyword"},
      "user_id": {"type": "keyword"},
      "environment": {"type": "keyword"},
      "metadata": {"type": "object"}
    }
  }
}
```

---

## 🔄 Sistema de Filas (Bull + Redis)

### **Arquitetura das Filas**

```mermaid
graph LR
    A[Log Event] --> B[logs-processing]
    B --> C[Salva no Elasticsearch]
    C --> D{É Erro?}
    D -->|Sim| E[alerts-processing]
    D -->|Não| F[metrics-processing]
    E --> G[Cria Alerta]
    G --> H[notifications]
    F --> I[Atualiza Métricas]
    H --> J[Envia Notificação]
```

### **Filas Principais**

| Fila | Função | Prioridade | Retry |
|------|--------|------------|-------|
| `logs-processing` | Processamento de logs | Normal | 3x |
| `alerts-processing` | Criação de alertas | Alta | 5x |
| `metrics-processing` | Atualização de métricas | Baixa | 2x |
| `notifications` | Envio de notificações | Normal | 3x |
| `ml-processing` | Processamento de ML | Baixa | 2x |
| `exports` | Exportação de dados | Baixa | 1x |

### **Implementação com NestJS**

```typescript
// Configuração das Filas
@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
    BullModule.registerQueue(
      { name: 'logs' },
      { name: 'alerts' },
      { name: 'metrics' },
      { name: 'notifications' },
      { name: 'ml' },
      { name: 'exports' }
    ),
  ],
})
export class QueueModule {}

// Processador de Logs
@Processor('logs')
export class LogProcessor {
  @Process('process-log')
  async handleLog(job: Job<LogData>) {
    const { data } = job;
    
    try {
      // Salva no Elasticsearch
      await this.elasticsearchService.index({
        index: 'logs',
        body: data
      });

      // Atualiza cache em tempo real
      await this.redisService.set(
        `metrics:realtime:${data.serviceId}`,
        JSON.stringify(data),
        'EX',
        300
      );

      // Se for erro, cria alerta
      if (data.level === 'error') {
        await this.alertsQueue.add('create-alert', data, {
          priority: 1,
          delay: 0,
          attempts: 3,
        });
      }

      job.updateProgress(100);
    } catch (error) {
      throw error; // Bull faz retry automaticamente
    }
  }
}

// Processador de Alertas
@Processor('alerts')
export class AlertProcessor {
  @Process('create-alert')
  async handleAlert(job: Job<AlertData>) {
    const { data } = job;
    
    // Cria alerta no PostgreSQL
    const alert = await this.alertService.create({
      type: data.type,
      severity: data.severity,
      title: data.title,
      message: data.message,
      metadata: data.metadata
    });

    // Adiciona à fila de notificações
    await this.notificationsQueue.add('send-notification', {
      alertId: alert.id,
      type: 'email',
      recipients: alert.assignedTo
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });
  }
}
```

---

## 🏛️ Estrutura de Pastas

```
deep-eyes-dashboard/
│   ├── src/
│   │   ├── modules/                   # Módulos da aplicação
│   │   │   ├── auth/                  # Autenticação
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── guards/
│   │   │   │   └── strategies/
│   │   │   ├── metrics/               # Métricas
│   │   │   │   ├── metrics.controller.ts
│   │   │   │   ├── metrics.service.ts
│   │   │   │   ├── metrics.module.ts
│   │   │   │   └── entities/
│   │   │   ├── logs/                  # Logs
│   │   │   │   ├── logs.controller.ts
│   │   │   │   ├── logs.service.ts
│   │   │   │   ├── logs.module.ts
│   │   │   │   └── entities/
│   │   │   ├── alerts/                # Alertas
│   │   │   │   ├── alerts.controller.ts
│   │   │   │   ├── alerts.service.ts
│   │   │   │   ├── alerts.module.ts
│   │   │   │   └── entities/
│   │   │   ├── ml/                    # Machine Learning (Módulo Integrado)
│   │   │   │   ├── ml.controller.ts
│   │   │   │   ├── ml.service.ts
│   │   │   │   ├── ml.module.ts
│   │   │   │   ├── ml.processor.ts    # Processador de ML
│   │   │   │   ├── models/            # Modelos de ML
│   │   │   │   ├── algorithms/        # Algoritmos de ML
│   │   │   │   └── entities/
│   │   │   ├── security/              # Segurança
│   │   │   │   ├── security.controller.ts
│   │   │   │   ├── security.service.ts
│   │   │   │   ├── security.module.ts
│   │   │   │   └── entities/
│   │   │   ├── analytics/             # Analytics
│   │   │   │   ├── analytics.controller.ts
│   │   │   │   ├── analytics.service.ts
│   │   │   │   ├── analytics.module.ts
│   │   │   │   └── entities/
│   │   │   ├── telemetry/             # OpenTelemetry
│   │   │   │   ├── telemetry.controller.ts
│   │   │   │   ├── telemetry.service.ts
│   │   │   │   ├── telemetry.module.ts
│   │   │   │   └── interceptors/
│   │   │   └── queue/                 # Filas
│   │   │       ├── processors/
│   │   │       ├── queue.module.ts
│   │   │       └── queue.service.ts
│   │   ├── shared/                    # Recursos compartilhados
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   ├── decorators/
│   │   │   ├── dto/
│   │   │   └── utils/
│   │   ├── config/                    # Configurações
│   │   │   ├── database.config.ts
│   │   │   ├── redis.config.ts
│   │   │   ├── elasticsearch.config.ts
│   │   │   ├── opentelemetry.config.ts
│   │   │   └── app.config.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/                        # Schema do Prisma
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── package.json
│   └── nest-cli.json
│
├── docker/                            # Configurações Docker
│   ├── docker-compose.yml
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   ├── otel-collector-config.yaml     # OpenTelemetry Collector
│   └── nginx.conf
│
├── docs/                              # Documentação
│   ├── api.md
│   ├── deployment.md
│   ├── opentelemetry.md               # Documentação OpenTelemetry
│   └── development.md
│
└── README.md
```

---

## 🔄 Fluxo de Dados

### **1. Processamento de Logs**

```mermaid
sequenceDiagram
    participant App as Aplicação
    participant API as NestJS API
    participant Queue as Bull Queue
    participant ES as Elasticsearch
    participant Redis as Redis Cache
    participant PG as PostgreSQL

    App->>API: POST /logs
    API->>Queue: Adiciona à fila logs-processing
    API->>App: 200 OK (Resposta imediata)
    
    Queue->>ES: Salva log no Elasticsearch
    Queue->>Redis: Atualiza cache em tempo real
    
    alt Log é erro
        Queue->>Queue: Adiciona à fila alerts-processing
        Queue->>PG: Cria alerta no PostgreSQL
        Queue->>Queue: Adiciona à fila notifications
    end
```

### **2. Sistema de Alertas**

```mermaid
sequenceDiagram
    participant ML as ML Module
    participant API as NestJS API
    participant Queue as Bull Queue
    participant PG as PostgreSQL
    participant Email as Email Service

    ML->>API: Anomalia detectada
    API->>Queue: Adiciona à fila alerts-processing
    Queue->>PG: Cria alerta
    Queue->>Queue: Adiciona à fila notifications
    Queue->>Email: Envia notificação
```

### **3. Dados em Tempo Real**

```mermaid
sequenceDiagram
    participant App as Aplicação
    participant API as NestJS API
    participant Redis as Redis
    participant WS as WebSocket
    participant FE as Frontend

    App->>API: Métricas em tempo real
    API->>Redis: Salva no cache
    API->>WS: Broadcast via WebSocket
    WS->>FE: Atualização em tempo real
```

### **4. Machine Learning Integrado**

```mermaid
sequenceDiagram
    participant API as NestJS API
    participant ML as ML Module
    participant Queue as Bull Queue
    participant PG as PostgreSQL
    participant FE as Frontend

    API->>ML: Dados para análise
    ML->>ML: Processa com algoritmos
    ML->>Queue: Adiciona à fila ml-processing
    Queue->>PG: Salva resultados
    Queue->>FE: Atualiza dashboard ML
```

---

## 🤖 Machine Learning (Módulo Integrado)

### **Funcionalidades do Módulo ML**

#### **1. Detecção de Anomalias**
```typescript
@Injectable()
export class AnomalyDetectionService {
  async detectAnomalies(metrics: SystemMetrics[]): Promise<Anomaly[]> {
    // Implementação de algoritmos de detecção de anomalias
    // Isolation Forest, LOF, etc.
    return this.algorithmService.detect(metrics);
  }
}
```

#### **2. Análise Preditiva**
```typescript
@Injectable()
export class PredictiveAnalyticsService {
  async forecastMetrics(historicalData: MetricsData[], horizon: number): Promise<Forecast[]> {
    // Implementação de modelos preditivos
    // ARIMA, Prophet, LSTM, etc.
    return this.modelService.predict(historicalData, horizon);
  }
}
```

#### **3. Clustering e Segmentação**
```typescript
@Injectable()
export class ClusteringService {
  async performClustering(data: any[], algorithm: string): Promise<Cluster[]> {
    // Implementação de algoritmos de clustering
    // K-means, DBSCAN, Hierarchical, etc.
    return this.clusteringAlgorithm.cluster(data, algorithm);
  }
}
```

#### **4. Modelos de ML**
```typescript
// Estrutura de modelos
interface MLModel {
  id: string;
  name: string;
  type: 'anomaly' | 'prediction' | 'clustering' | 'classification';
  algorithm: string;
  parameters: Record<string, any>;
  accuracy: number;
  status: 'training' | 'ready' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}
```

### **Integração com Filas**
```typescript
@Processor('ml')
export class MLProcessor {
  @Process('detect-anomalies')
  async detectAnomalies(job: Job<MetricsData>) {
    const anomalies = await this.anomalyService.detectAnomalies(job.data);
    
    if (anomalies.length > 0) {
      await this.alertsQueue.add('create-anomaly-alert', {
        anomalies,
        source: 'ml-detection'
      });
    }
  }
  
  @Process('train-model')
  async trainModel(job: Job<TrainingData>) {
    const model = await this.mlService.trainModel(job.data);
    await this.mlService.saveModel(model);
  }
  
  @Process('forecast-metrics')
  async forecastMetrics(job: Job<ForecastRequest>) {
    const forecast = await this.predictionService.forecast(job.data);
    await this.metricsService.saveForecast(forecast);
  }
}
```

---

## 🔐 Segurança

### **1. Autenticação JWT**
```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    return this.authService.validateUser(payload.sub);
  }
}
```

### **2. Autorização por Roles**
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles) {
      return true;
    }
    
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

### **3. Rate Limiting**
```typescript
@Injectable()
export class ThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): string {
    return req.ips.length ? req.ips[0] : req.ip;
  }
}
```

---

## 📊 Monitoramento e Observabilidade

### **1. OpenTelemetry Integration**
- **OpenTelemetry Collector** para coleta de telemetria
- **Métricas, Logs e Traces** unificados
- **Instrumentação automática** de aplicações
- **Correlation IDs** para rastreamento distribuído

### **2. Métricas da Aplicação**
- **OpenTelemetry Metrics** para coleta de métricas
- **Deep Eyes Dashboard** para visualização customizada
- **Alertas automáticos** baseados em thresholds
- **Métricas customizadas** específicas do negócio

### **3. Logs Estruturados**
- **OpenTelemetry Logs** para logs estruturados
- **Elasticsearch** para armazenamento
- **Deep Eyes Dashboard** para visualização e análise
- **Log parsing** automático com OpenTelemetry

### **4. Tracing Distribuído**
- **OpenTelemetry Traces** para distributed tracing
- **Correlation IDs** para rastreamento entre serviços
- **Performance monitoring** por endpoint
- **Service map** automático no dashboard

---

## 🚀 Deployment

### **1. Docker Compose**
```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/deep_eyes
      - REDIS_URL=redis://redis:6379
      - ELASTICSEARCH_URL=http://elasticsearch:9200
    depends_on:
      - postgres
      - redis
      - elasticsearch

  postgres:
    image: timescale/timescaledb:latest-pg14
    environment:
      - POSTGRES_DB=deep_eyes
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  otel-collector:
    image: otel/opentelemetry-collector:latest
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
      - "8888:8888"   # Metrics
      - "8889:8889"   # Prometheus metrics
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    command: ["--config", "/etc/otel-collector-config.yaml"]
    depends_on:
      - elasticsearch
      - postgres

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:
```

### **2. CI/CD Pipeline**
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          cd backend && npm test
          cd ../frontend && npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and push Docker images
        run: |
          docker build -t deep-eyes-frontend ./frontend
          docker build -t deep-eyes-backend ./backend
          # Push to registry

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # Deploy using docker-compose or k8s
```

---

## 📈 Escalabilidade

### **1. Horizontal Scaling**
- **Load Balancer** para múltiplas instâncias
- **Database clustering** (PostgreSQL + TimescaleDB)
- **Redis clustering** para cache distribuído
- **Elasticsearch cluster** para logs

### **2. Performance Optimization**
- **Connection pooling** para bancos de dados
- **Caching strategies** (Redis)
- **CDN** para assets estáticos
- **Database indexing** otimizado
- **OpenTelemetry instrumentation** para performance monitoring

### **3. Monitoring at Scale**
- **Distributed tracing** com OpenTelemetry
- **Centralized logging** com ELK Stack
- **Metrics aggregation** com OpenTelemetry
- **Alerting** com Deep Eyes Dashboard

---

## 🔧 Desenvolvimento

### **1. Setup Local**
```bash
# Clone o repositório
git clone <repository-url>
cd deep-eyes-dashboard

# Backend
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev

# Frontend
cd ../frontend
npm install
npm run dev

# Infraestrutura
docker-compose up -d
```

### **2. Scripts Úteis**
```bash
# Backend
npm run build          # Build da aplicação
npm run start:prod     # Produção
npm run test           # Testes unitários
npm run test:e2e       # Testes E2E
npm run prisma:studio  # Interface do Prisma

# Frontend
npm run build          # Build da aplicação
npm run preview        # Preview da build
npm run lint           # Linting
```

---

## 📚 Recursos Adicionais

- **Documentação da API**: Swagger UI em `/api/docs`
- **Monitoramento**: Deep Eyes Dashboard em `http://localhost:3000`
- **OpenTelemetry Collector**: `http://localhost:8888/metrics`
- **Filas**: Bull Board em `/admin/queues`
- **Database**: Prisma Studio em `http://localhost:5555`

---

## 🤝 Contribuição

1. Fork o repositório
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está licenciado sob a MIT License.

---

**Deep Eyes Dashboard** - Plataforma completa de observabilidade para aplicações modernas. 