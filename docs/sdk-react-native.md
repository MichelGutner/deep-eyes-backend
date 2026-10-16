# Deep Eyes SDK — React Native

Documentação de contrato para implementação do SDK de observabilidade React Native que alimenta o Deep Eyes Dashboard.

---

## Visão Geral

O SDK captura automaticamente e envia ao backend:

| Captura | Mecanismo |
|---------|-----------|
| Erros JS não tratados | `ErrorUtils.setGlobalHandler` |
| Crashes nativos | Módulo nativo (Objective-C / Kotlin) |
| Navegação entre telas | Listener do React Navigation |
| Requisições HTTP | Interceptor global de `fetch` / `XMLHttpRequest` |
| Logs manuais | `DeepEyes.log(level, message, metadata?)` |
| Contexto de dispositivo | `react-native` APIs (Platform, DeviceInfo) |

---

## Obtendo a API Key

Cada `apiKey` é gerada automaticamente na criação de uma `Application` (`apiKey String @unique @default(uuid())` no Prisma) e fica visível no dashboard em **Configurações → API Keys**, que consome `GET /applications` (autenticado com Bearer token de usuário — não confundir com a autenticação do SDK, que usa a `apiKey` diretamente no body de `/logs/batch`).

---

## Instalação e Inicialização

```typescript
// App.tsx (root do projeto, antes de qualquer outra coisa)
import { DeepEyesSDK } from '@deep-eyes/react-native';

DeepEyesSDK.init({
  // Obrigatórios
  apiKey: 'sua-api-key-aqui',             // Application.apiKey — copiada da aba API Keys do dashboard
  endpoint: 'https://api.deepeyes.io',    // URL base do backend

  // Contexto da release
  environment: 'production',              // production | staging | development
  release: '1.0.0',                       // versão do app (use Constants.expoConfig.version no Expo)

  // Captura automática
  captureUnhandledErrors: true,
  captureNativeCrashes: true,
  captureNavigation: true,
  captureHttpRequests: true,

  // Buffer e envio
  maxBatchSize: 50,       // máximo de logs por batch enviado (hard cap do backend: 100 — ArrayMaxSize)
  flushInterval: 5000,    // flush a cada 5 segundos (ms)
  maxQueueSize: 500,      // máximo de logs bufferizados em memória

  // Desenvolvimento
  debug: false,           // true para logar internamente no console
});
```

---

## Uso Manual

```typescript
import { DeepEyes } from '@deep-eyes/react-native';

// Identificar o usuário logado
DeepEyes.setUser({ id: 'usr_123', email: 'user@example.com' });

// Limpar usuário no logout
DeepEyes.clearUser();

// Logs manuais
DeepEyes.log('info', 'Carrinho aberto', { itemCount: 3 });
DeepEyes.log('warn', 'Tentativa de pagamento falhou', { attempt: 2 });

// Capturar erro manualmente (com contexto)
try {
  await processPayment(cart);
} catch (err) {
  DeepEyes.captureError(err, {
    tags: ['payment', 'checkout'],
    metadata: { cartId: cart.id, amount: cart.total },
  });
}

// Adicionar breadcrumb manual
DeepEyes.addBreadcrumb({
  type: 'ui',
  category: 'button_press',
  message: 'Usuário clicou em "Finalizar Compra"',
  data: { screen: 'Cart', itemCount: 3 },
});
```

---

## Endpoint de Ingestion

### `POST /logs/batch`

Todos os eventos são enviados para este único endpoint em formato batch. Endpoint público (`@Public()`), autenticado via `apiKey` no corpo — não usa Bearer token. Limitado a **30 requisições/minuto** por origem (`@Throttle`).

#### Request

```typescript
interface BatchPayload {
  apiKey: string;     // Application.apiKey — validado contra a tabela applications
  batch: LogEntry[];  // array de eventos — máx 100 itens por requisição (ArrayMaxSize)
}
```

> O nome do campo é `apiKey`, **não** `dsn` — o schema do Prisma renomeou `dsn` → `apiKey` (migration `20260625120000_rename_dsn_to_apikey`). Um `apiKey` inválido responde `401 { message: "Invalid API Key" }` antes mesmo de validar o batch.

#### `LogEntry` — schema completo

```typescript
interface LogEntry {
  // ── Identificação ────────────────────────────────────────────────
  message: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  platform: 'ios' | 'android';
  app: string;              // bundle ID (ex: 'com.empresa.meuapp')
  environment: string;      // production | staging | development
  release: string;          // versão do app (ex: '2.1.0')
  timestamp: string;        // ISO 8601 — gerado no dispositivo no momento do evento
  fingerprint?: string;     // SHA1(errorType + filename + lineno) — para agrupamento de erros

  // ── Erro ─────────────────────────────────────────────────────────
  // Obrigatório quando level = 'error' | 'fatal'
  error?: {
    id: string;             // UUID gerado pelo SDK
    name: string;           // ex: 'TypeError', 'ReferenceError', 'SIGSEGV', 'NSInvalidArgumentException'
    message: string;        // mensagem do erro
    stack?: string;         // stack trace raw (string)
    cause?: {               // erro original se wrappado
      name: string;
      message: string;
      stack?: string;
    };
  };

  // Stack frames parseados do stack raw
  stackFrames?: StackFrame[];

  // ── Breadcrumbs ──────────────────────────────────────────────────
  // Últimos N eventos capturados antes do erro (recomendado: 20)
  breadcrumbs?: Breadcrumb[];

  // ── Contexto do usuário ──────────────────────────────────────────
  user?: {
    id: string;
    email?: string;
    sessionId?: string;     // ID gerado pelo SDK na abertura do app
    ip?: string;
  };

  // ── Contexto do dispositivo ──────────────────────────────────────
  device?: DeviceContext;

  // ── Contexto HTTP ────────────────────────────────────────────────
  // Preenchido quando o log é gerado por uma requisição de rede
  http?: HttpContext;

  // ── SDK (opcional no DTO, mas o SDK deve sempre enviar) ───────────
  sdk?: {
    name: string;           // '@deep-eyes/react-native'
    version: string;        // versão do SDK
    integrations?: string[];// ex: ['react-navigation', 'fetch-interceptor']
  };

  // ── Metadata ────────────────────────────────────────────────────
  tags?: string[];
  metadata?: Record<string, unknown>;
}
```

> `traceId`/`spanId` **não** fazem parte do payload — são gerados no backend pelo OpenTelemetry (`TracingService.addTraceInfoToLog`) depois que o log chega. O SDK não precisa e não deve enviá-los.
>
> Campos aceitos pelo `LogInputDto` mas fora do escopo do SDK React Native: `statusCode` (nível raiz, distinto de `http.statusCode` — uso interno de logs de request HTTP do backend). `platform` aceita apenas `'web' | 'ios' | 'android' | 'backend' | 'other'` — o SDK deve enviar `Platform.OS` (`'ios'` ou `'android'`).

#### Tipos auxiliares

```typescript
interface StackFrame {
  filename: string;         // ex: 'src/screens/Home.tsx'
  function: string;         // ex: 'handlePress'
  lineno?: number;
  colno?: number;
  in_app: boolean;          // true = código do app; false = biblioteca
  module?: string;          // ex: 'react-navigation'
  context_line?: string;    // linha exata do código-fonte
  pre_context?: string[];   // até 3 linhas antes
  post_context?: string[];  // até 3 linhas depois
}

interface Breadcrumb {
  timestamp: string;        // ISO 8601
  type: 'navigation' | 'http' | 'ui' | 'console' | 'error' | 'query' | 'lifecycle';
  category: string;         // ex: 'screen_view', 'fetch', 'button_press', 'app_background'
  message: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  data?: Record<string, string | number | boolean>;
}

interface DeviceContext {
  os: 'ios' | 'android';
  osVersion: string;        // ex: '17.4.1' (iOS) ou '14' (Android)
  model: string;            // ex: 'iPhone 15 Pro', 'Pixel 8'
  manufacturer?: string;    // ex: 'Apple', 'Google', 'Samsung'
  appVersion: string;       // versão do app (igual ao release)
  locale: string;           // ex: 'pt-BR'
  timezone: string;         // ex: 'America/Sao_Paulo'
  online: boolean;
  memoryMb?: number;        // memória RAM disponível em MB
  simulator: boolean;       // true se rodando em simulador/emulador
  orientation?: 'portrait' | 'landscape';
  battery?: number;         // 0.0 a 1.0 (ex: 0.85 = 85%)
  arch?: string;            // ex: 'arm64', 'x86_64'
  screenResolution?: string;// ex: '393x852'
}

interface HttpContext {
  method?: string;          // GET, POST, PUT, DELETE, PATCH
  url?: string;             // URL sem dados sensíveis na query string
  statusCode?: number;
  responseTime?: number;    // ms
  queryString?: string;     // sanitizada (sem tokens, senhas)
  bodySize?: number;        // bytes
  headers?: Record<string, string>; // apenas headers não-sensíveis
}
```

---

## Mapeamento por tipo de evento

| Tipo de evento | `level` | `error` | `breadcrumb.type` | Campos extras obrigatórios |
|---------------|---------|---------|-------------------|---------------------------|
| Erro JS não tratado | `error` | ✅ | `error` | `stackFrames`, `fingerprint` |
| Crash nativo | `fatal` | ✅ `name: <exceção/sinal real>` | `error` | `tags: ['native-crash', ...]`, `fingerprint` |
| Troca de tela | `info` | ❌ | `navigation` | `breadcrumb.data = { from, to }` |

> **Nota (crash nativo):** o nome real da exceção/sinal (ex.: `NSInvalidArgumentException`, `SIGSEGV`, `java.lang.NullPointerException`) vai em `error.name` — não a string literal `'NativeCrash'` — para que o `fingerprint` agrupe por tipo real de crash em vez de colapsar tudo num único grupo. O tipo do evento (`exception` vs `signal`/JVM) fica em `tags` e em `metadata.nativeCrashType`. Sem breadcrumbs: o processo morreu antes de qualquer flush, então não há trilha da sessão anterior — apenas `device` e o stack nativo bruto em `error.stack`. O backend simbolica esse stack na ingestão quando há símbolos enviados para a release — ver [Simbolicação de crashes nativos](#simbolicação-de-crashes-nativos-upload-de-símbolos).
| Requisição HTTP erro | `warn`/`error` | opcional | `http` | `http.*` |
| Requisição HTTP ok | `info` | ❌ | `http` | `http.*` |
| Log manual | qualquer | opcional | `console` | — |
| App em background | `info` | ❌ | `lifecycle` | `breadcrumb.category = 'app_background'` |
| App em foreground | `info` | ❌ | `lifecycle` | `breadcrumb.category = 'app_foreground'` |

---

## Respostas do Backend

```
200 OK  (sempre este status quando o request é aceito — mesmo com itens rejeitados)
{ "accepted": 5, "rejected": 0 }
{ "accepted": 4, "rejected": 1, "errors": ["Log index 2: <mensagem do erro>"] }

400 Bad Request   (payload malformado — falha de class-validator no DTO)
{ "statusCode": 400, "message": ["batch.0.level must be a valid enum value"], "error": "Bad Request" }

401 Unauthorized  (apiKey inválida ou de outra organização)
{ "statusCode": 401, "message": "Invalid API Key" }

429 Too Many Requests  (mais de 30 requisições/minuto)
{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests" }

503 Service Unavailable  (falha ao processar o batch internamente)
{ "statusCode": 503, "message": "Batch ingest failed. Please try again later." }
```

> O backend não retorna `207` nem headers `X-RateLimit-*` hoje — o SDK deve tratar `200` com `rejected > 0` como sucesso parcial e não deve depender de headers de rate limit que ainda não existem.

---

## Comportamento de retry e buffer

| Cenário | Ação do SDK |
|---------|-------------|
| Erro de rede (timeout, sem internet) | Retry com backoff: 1s → 2s → 4s → 8s (máx 4 tentativas) |
| Resposta 5xx | Retry com backoff exponencial |
| Resposta 400 | Descartar o batch (payload inválido, não vai melhorar) |
| Resposta 401 | Descartar e logar erro no console (apiKey inválida) |
| Resposta 429 | Aguardar `retryAfter` segundos antes de tentar novamente |
| App vai para background | Persistir fila no `AsyncStorage` |
| App volta do background | Carregar fila do `AsyncStorage` e tentar flush |

---

## Geração do `fingerprint`

O fingerprint agrupa erros do mesmo tipo para o dashboard de Error Monitoring:

```typescript
function generateFingerprint(errorName: string, topFrame?: StackFrame): string {
  const parts = [
    errorName,
    topFrame?.filename ?? '',
    String(topFrame?.lineno ?? ''),
  ].join('|');
  
  return sha1(parts).slice(0, 12); // 12 chars é suficiente
}
```

Se o backend não receber `fingerprint`, ele deve calcular usando o mesmo algoritmo antes de indexar no Elasticsearch.

---

## Simbolicação de crashes nativos (upload de símbolos)

O SDK manda o stack nativo como o dispositivo o viu: classes Java ofuscadas pelo R8 (`a.b.c(SourceFile:12)`), endereços de retorno no iOS e offsets dentro de `.so` no Android (`[rel 0x1d4e]`). Para virar `função (arquivo:linha)`, o backend precisa dos símbolos da build — enviados uma vez por release, no build de release / CI.

Na ingestão (`POST /logs/batch`), para cada log com `error.stack`:

| Plataforma | Frames | Símbolo usado | Ferramenta no servidor |
|------------|--------|---------------|------------------------|
| Android | Java/Kotlin (`a.b.c(SourceFile:12)`) e `error.name` | `mapping.txt` da `release` | nenhuma (retrace em TS) |
| Android | NDK (`#00 pc … libapp.so [rel 0x…]`) | `.so` não-stripped da `release` + ABI | `llvm-symbolizer` |
| iOS | linhas com endereço (`0x0000000102a4c123`), via `metadata.frameAddresses` + `metadata.images` | dSYM pelo UUID da imagem | `llvm-symbolizer` ou `atos` |

Quando algo foi resolvido, o log é indexado com `error.stack` reescrito e:

```jsonc
"metadata": {
  "symbolicated": true,
  "symbolicatedWith": ["r8-mapping"],      // | "dsym" | "native-lib"
  "rawStack": ["a.b.c(SourceFile:12)", …]  // stack original, como o SDK enviou
}
```

É best-effort: sem símbolo para a release, ou sem `llvm-symbolizer`/`atos` no host, o stack fica exatamente como chegou e o log é aceito normalmente. O `fingerprint` não muda (é calculado no device a partir dos frames ofuscados, estáveis dentro de uma release).

### Endpoints

Todos exigem **Bearer token de usuário** (`POST /auth/login`) — não a `apiKey`: a `apiKey` vai embutida no binário do app, então não pode servir para sobrescrever símbolos. A aplicação precisa ser da organização do usuário.

| Método | Rota | Multipart | Uso |
|--------|------|-----------|-----|
| `POST` | `/applications/:applicationId/symbols/android-mapping` | `file`, `release` | `mapping.txt` do R8/ProGuard |
| `POST` | `/applications/:applicationId/symbols/native-lib` | `file`, `release`, `arch?`, `name?` | `.so` não-stripped (NDK) |
| `POST` | `/applications/:applicationId/symbols/dsym` | `file` | `.dSYM` zipado (um ou vários) ou o arquivo DWARF puro — indexado pelo UUID, sem `release` |
| `GET` | `/applications/:applicationId/symbols` | — | lista o que foi enviado |
| `DELETE` | `/applications/:applicationId/symbols/:symbolId` | — | remove |

Reenviar para a mesma chave (release / UUID / release+ABI+lib) substitui o arquivo anterior.

> **`release` precisa ser idêntica à `release` que o SDK envia.** No app-entregador ela é `` `${CONFIG.package}@${CONFIG.version}` `` (`src/modules/observability/deepEyes.ts`), ex.: `com.husky@2.4.11` — não só o `versionName`.

```bash
export DEEP_EYES_URL=https://api.deepeyes.io
export DEEP_EYES_APP_ID=<Application.id>
export DEEP_EYES_TOKEN=$(curl -sS -X POST "$DEEP_EYES_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ci@empresa.com","password":"…"}' | jq -r .accessToken)
```

### Android — `mapping.txt` (app-entregador)

O R8 só roda (e só gera `mapping.txt`) com `android.enableMinifyInReleaseBuilds=true` em `android/gradle.properties` — hoje o padrão do app-entregador é `false`, e nesse caso as classes não são ofuscadas e não há nada a enviar.

```bash
curl --fail -sS \
  -H "Authorization: Bearer $DEEP_EYES_TOKEN" \
  -F "release=com.husky@2.4.11" \
  -F "file=@android/app/build/outputs/mapping/release/mapping.txt" \
  "$DEEP_EYES_URL/applications/$DEEP_EYES_APP_ID/symbols/android-mapping"
```

Automático a cada `assembleRelease`/`bundleRelease`, em `android/app/build.gradle`:

```groovy
// Envia o mapping.txt ao Deep Eyes depois do R8. Pula silenciosamente sem DEEP_EYES_TOKEN.
def deepEyesRelease = System.getenv('DEEP_EYES_RELEASE') ?: "com.husky@${android.defaultConfig.versionName}"

tasks.register('uploadDeepEyesMapping', Exec) {
    def mapping = layout.buildDirectory.file('outputs/mapping/release/mapping.txt').get().asFile
    onlyIf { mapping.exists() && System.getenv('DEEP_EYES_TOKEN') }
    commandLine 'curl', '--fail', '-sS',
        '-H', "Authorization: Bearer ${System.getenv('DEEP_EYES_TOKEN')}",
        '-F', "release=${deepEyesRelease}",
        '-F', "file=@${mapping}",
        "${System.getenv('DEEP_EYES_URL')}/applications/${System.getenv('DEEP_EYES_APP_ID')}/symbols/android-mapping"
}

afterEvaluate {
    tasks.matching { it.name == 'minifyReleaseWithR8' }.configureEach { finalizedBy 'uploadDeepEyesMapping' }
}
```

### Android — `.so` não-stripped (frames NDK, opcional)

Os `.so` com debug info ficam antes do strip, um por ABI. `arch` aceita o nome da ABI (`arm64-v8a`, `armeabi-v7a`, `x86_64`, `x86`) ou o nome do diretório que aparece no stack (`arm64`, `arm`); sem `arch`, o arquivo vale para qualquer ABI.

```bash
OUT=android/app/build/intermediates/merged_native_libs/release/mergeReleaseNativeLibs/out/lib
for abi in arm64-v8a armeabi-v7a; do
  for so in "$OUT/$abi"/*.so; do
    curl --fail -sS -H "Authorization: Bearer $DEEP_EYES_TOKEN" \
      -F "release=com.husky@2.4.11" -F "arch=$abi" -F "file=@$so" \
      "$DEEP_EYES_URL/applications/$DEEP_EYES_APP_ID/symbols/native-lib"
  done
done
```

Na prática, só vale enviar as libs do próprio app (as de terceiros como `libhermes.so`/`libreactnative.so` raramente vêm com debug info).

### iOS — dSYM

O Xcode gera dSYM em Release por padrão (`DEBUG_INFORMATION_FORMAT = dwarf-with-dsym`). Um zip pode conter vários `.dSYM` (app + frameworks); cada slice é indexado pelo UUID — o mesmo `metadata.images[].uuid` que o SDK envia —, então não há `release` aqui.

```bash
# Do .xcarchive gerado pelo Archive / fastlane gym:
rm -f /tmp/dsyms.zip && (cd "build/Entregador.xcarchive/dSYMs" && zip -qr /tmp/dsyms.zip .)
curl --fail -sS -H "Authorization: Bearer $DEEP_EYES_TOKEN" \
  -F "file=@/tmp/dsyms.zip" \
  "$DEEP_EYES_URL/applications/$DEEP_EYES_APP_ID/symbols/dsym"
# → { "images": [{ "uuid": "F8632B069F223D8094E21BF430D9FE05", "arch": "arm64", "name": "Entregador" }, …] }
```

Ou como Run Script Build Phase (depois de "Embed Frameworks"), só em Release:

```bash
if [ "$CONFIGURATION" = "Release" ] && [ -n "$DEEP_EYES_TOKEN" ]; then
  rm -f "$TEMP_DIR/dsyms.zip"
  (cd "$DWARF_DSYM_FOLDER_PATH" && zip -qr "$TEMP_DIR/dsyms.zip" *.dSYM)
  curl --fail -sS -H "Authorization: Bearer $DEEP_EYES_TOKEN" \
    -F "file=@$TEMP_DIR/dsyms.zip" \
    "$DEEP_EYES_URL/applications/$DEEP_EYES_APP_ID/symbols/dsym" || echo "warning: upload de dSYM falhou"
fi
```

### Requisitos e configuração do servidor

| Item | Detalhe |
|------|---------|
| `llvm-symbolizer` | Necessário para frames NDK; usado também para iOS quando presente (Linux: `apk add llvm` / `apt-get install llvm`; macOS: `brew install llvm`). Procurado no `PATH` (inclusive `llvm-symbolizer-NN`) ou em `LLVM_SYMBOLIZER_PATH`. |
| `atos` | Fallback para iOS em hosts macOS com Xcode. |
| `unzip` | Para dSYMs zipados (no macOS, `ditto` serve). Sem ele, envie o arquivo DWARF puro (`X.dSYM/Contents/Resources/DWARF/X`). |
| `SYMBOLS_DIR` | Onde os arquivos ficam (padrão `./data/symbols`; o Postgres guarda só o índice, tabela `symbol_files`). Precisa ser um volume persistente em produção. |
| `SYMBOLS_MAX_UPLOAD_MB` | Limite por upload (padrão `1024`). |

Sem nenhuma das ferramentas, só a retrace de Java/Kotlin funciona (ela não depende de binário externo).

---

## Exemplo completo de payload

```json
{
  "apiKey": "3f679dc0-9d70-4341-987b-ebf84c1ede3f",
  "batch": [
    {
      "message": "TypeError: Cannot read property 'id' of undefined",
      "level": "error",
      "platform": "ios",
      "app": "com.empresa.meuapp",
      "environment": "production",
      "release": "2.1.0",
      "fingerprint": "a3f9c1d2e8b7",
      "timestamp": "2026-06-24T14:32:10.123Z",

      "error": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "TypeError",
        "message": "Cannot read property 'id' of undefined",
        "stack": "TypeError: Cannot read property 'id' of undefined\n  at handlePress (src/screens/Home.tsx:42:15)\n  at onPress (node_modules/react-native/Libraries/TouchableOpacity.js:124:12)"
      },

      "stackFrames": [
        {
          "filename": "src/screens/Home.tsx",
          "function": "handlePress",
          "lineno": 42,
          "colno": 15,
          "in_app": true,
          "context_line": "  const id = user.id;",
          "pre_context": ["  const handlePress = () => {", "    const user = getUser();"],
          "post_context": ["    navigate('Profile', { id });", "  };"]
        },
        {
          "filename": "node_modules/react-native/Libraries/TouchableOpacity.js",
          "function": "onPress",
          "lineno": 124,
          "colno": 12,
          "in_app": false,
          "module": "react-native"
        }
      ],

      "breadcrumbs": [
        {
          "timestamp": "2026-06-24T14:32:05.000Z",
          "type": "navigation",
          "category": "screen_view",
          "message": "Navegou para Home",
          "data": { "from": "Login", "to": "Home" }
        },
        {
          "timestamp": "2026-06-24T14:32:09.500Z",
          "type": "http",
          "category": "fetch",
          "message": "GET /api/users/me",
          "level": "info",
          "data": { "status": 200, "duration": 234 }
        },
        {
          "timestamp": "2026-06-24T14:32:10.100Z",
          "type": "ui",
          "category": "button_press",
          "message": "Usuário pressionou 'Ver Perfil'"
        }
      ],

      "user": {
        "id": "usr_987",
        "email": "usuario@exemplo.com",
        "sessionId": "sess_abc123"
      },

      "device": {
        "os": "ios",
        "osVersion": "17.4.1",
        "model": "iPhone 15 Pro",
        "manufacturer": "Apple",
        "appVersion": "2.1.0",
        "locale": "pt-BR",
        "timezone": "America/Sao_Paulo",
        "online": true,
        "memoryMb": 512,
        "simulator": false,
        "orientation": "portrait",
        "battery": 0.78,
        "arch": "arm64",
        "screenResolution": "393x852"
      },

      "sdk": {
        "name": "@deep-eyes/react-native",
        "version": "1.0.0",
        "integrations": ["react-navigation", "fetch-interceptor"]
      },

      "tags": ["checkout-flow", "home-screen"],
      "metadata": {
        "cartItemCount": 3,
        "userPlan": "premium"
      }
    }
  ]
}
```
