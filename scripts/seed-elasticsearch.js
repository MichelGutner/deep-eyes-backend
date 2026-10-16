/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('@elastic/elasticsearch');
const { randomUUID } = require('crypto');

const ES_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const INDEX = 'logs-test-development';

const client = new Client({ node: ES_URL });

const APPS = [
  {
    app: 'deep-eyes-web',
    platform: 'web',
    entityType: 'web',
    environment: 'production',
    release: '1.4.2',
    sdk: { name: '@deep-eyes/browser', version: '1.2.0', integrations: ['fetch-interceptor', 'react-router'] },
  },
  {
    app: 'deep-eyes-api',
    platform: 'backend',
    entityType: 'service',
    environment: 'production',
    release: '2.0.1',
    sdk: { name: '@deep-eyes/node', version: '1.1.3', integrations: ['express', 'kafka'] },
  },
  {
    app: 'deep-eyes-mobile',
    platform: 'ios',
    entityType: 'mobile',
    environment: 'staging',
    release: '0.9.0',
    sdk: { name: '@deep-eyes/react-native', version: '1.0.0', integrations: ['react-navigation', 'fetch-interceptor'] },
  },
];

const LEVELS = ['debug', 'info', 'info', 'info', 'warn', 'error', 'fatal'];

const ERROR_TYPES = [
  {
    name: 'TypeError',
    message: "Cannot read property 'id' of undefined",
    frame: { file: 'src/screens/Home.tsx', fn: 'handlePress' },
    line: '  const id = user.id;',
    pre: ['  const handlePress = () => {', '    const user = getUser();'],
    post: ['    navigate(\'Profile\', { id });', '  };'],
  },
  {
    name: 'NetworkError',
    message: 'Request failed with status code 503',
    frame: { file: 'src/services/httpClient.ts', fn: 'request' },
    line: '  if (!response.ok) throw new NetworkError(response.status);',
    pre: ['  const response = await fetch(url, options);', '  logRequest(url, response.status);'],
    post: ['  return response.json();', '}'],
  },
  {
    name: 'ValidationError',
    message: 'Invalid payload: missing field "email"',
    frame: { file: 'src/controllers/user.controller.ts', fn: 'validateBody' },
    line: '  if (!body.email) throw new ValidationError(\'email\');',
    pre: ['function validateBody(body) {', '  assertShape(body, schema);'],
    post: ['  return body;', '}'],
  },
  {
    name: 'TimeoutError',
    message: 'Request timed out after 5000ms',
    frame: { file: 'src/services/httpClient.ts', fn: 'withTimeout' },
    line: '  throw new TimeoutError(`Request timed out after ${ms}ms`);',
    pre: ['  const timer = setTimeout(() => {', '    controller.abort();'],
    post: ['  }, ms);', '  return controller.signal;'],
  },
  {
    name: 'DatabaseError',
    message: 'Connection pool exhausted',
    frame: { file: 'src/db/pool.ts', fn: 'acquireConnection' },
    line: '  throw new DatabaseError(\'Connection pool exhausted\');',
    pre: ['async function acquireConnection() {', '  if (pool.idleCount === 0 && pool.totalCount >= pool.max) {'],
    post: ['  }', '  return pool.connect();'],
    cause: { name: 'ETIMEDOUT', message: 'connect ETIMEDOUT 10.0.4.12:5432' },
  },
];

const LIB_FRAMES = [
  { file: 'node_modules/react-native/Libraries/Components/Touchable/TouchableOpacity.js', fn: 'onPress', module: 'react-native' },
  { file: 'node_modules/express/lib/router/layer.js', fn: 'handle', module: 'express' },
  { file: 'node_modules/axios/lib/adapters/xhr.js', fn: 'dispatchXhrRequest', module: 'axios' },
];

const ROUTES = [
  { method: 'GET', url: '/api/users/me', statusCode: 200 },
  { method: 'GET', url: '/api/logs', statusCode: 200 },
  { method: 'POST', url: '/api/checkout', statusCode: 201 },
  { method: 'POST', url: '/auth/login', statusCode: 200 },
  { method: 'GET', url: '/api/resource/42', statusCode: 404 },
  { method: 'POST', url: '/api/checkout', statusCode: 500 },
];

const DEVICE_BY_PLATFORM = {
  web: () => ({
    browser: pick(['Chrome', 'Safari', 'Firefox', 'Edge']),
    browserVersion: `${randomBetween(118, 132)}.0`,
    os: pick(['macOS', 'Windows', 'Linux']),
    osVersion: pick(['14.4', '11', '22.04']),
    screenResolution: pick(['1920x1080', '2560x1440', '1440x900']),
    locale: pick(['pt-BR', 'en-US']),
    timezone: 'America/Sao_Paulo',
    online: true,
  }),
  backend: () => ({
    os: 'linux',
    osVersion: '5.15.0',
    arch: 'x86_64',
    appVersion: '2.0.1',
    memoryMb: randomBetween(256, 1024),
    locale: 'en-US',
    timezone: 'UTC',
    online: true,
  }),
  ios: () => ({
    os: 'ios',
    osVersion: pick(['17.4.1', '17.5', '18.0']),
    model: pick(['iPhone 15 Pro', 'iPhone 14', 'iPhone SE']),
    manufacturer: 'Apple',
    appVersion: '0.9.0',
    locale: 'pt-BR',
    timezone: 'America/Sao_Paulo',
    online: Math.random() > 0.1,
    memoryMb: randomBetween(256, 512),
    simulator: false,
    orientation: pick(['portrait', 'landscape']),
    battery: Math.round(Math.random() * 100) / 100,
    arch: 'arm64',
    screenResolution: pick(['393x852', '390x844']),
  }),
};

const NAV_SCREENS = ['Home', 'Login', 'Profile', 'Checkout', 'Settings', 'ProductList'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

function buildBreadcrumbs(baseTimestamp, route) {
  const t = new Date(baseTimestamp).getTime();
  const at = (secAgo) => new Date(t - secAgo * 1000).toISOString();
  const from = pick(NAV_SCREENS);
  const to = pick(NAV_SCREENS);
  return [
    { timestamp: at(45), type: 'lifecycle', category: 'app_foreground', message: 'App moved to foreground' },
    { timestamp: at(30), type: 'navigation', category: 'screen_view', message: `Navigated from ${from} to ${to}`, data: { from, to } },
    { timestamp: at(12), type: 'ui', category: 'button_press', message: 'User pressed action button' },
    { timestamp: at(5), type: 'http', category: 'fetch', message: `${route.method} ${route.url}`, level: 'info', data: { status: route.statusCode, duration: randomBetween(40, 600) } },
    { timestamp: at(1), type: 'console', category: 'log', message: 'Preparing request payload', level: 'debug' },
  ];
}

function buildStackFrames(errType, app) {
  const primary = {
    filename: errType.frame.file,
    function: errType.frame.fn,
    lineno: randomBetween(10, 220),
    colno: randomBetween(1, 60),
    in_app: true,
    context_line: errType.line,
    pre_context: errType.pre,
    post_context: errType.post,
  };
  const lib = pick(LIB_FRAMES);
  return [
    primary,
    {
      filename: lib.file,
      function: lib.fn,
      lineno: randomBetween(20, 400),
      colno: randomBetween(1, 30),
      in_app: false,
      module: lib.module,
    },
  ];
}

function buildError(errType, app) {
  const stackFrames = buildStackFrames(errType, app);
  const stackLines = [
    `${errType.name}: ${errType.message}`,
    ...stackFrames.map(
      (f) => `    at ${f.function} (${f.filename}:${f.lineno}:${f.colno})`,
    ),
  ];

  const error = {
    id: randomUUID(),
    name: errType.name,
    message: errType.message,
    stack: stackLines,
  };

  if (errType.cause) {
    error.cause = {
      id: randomUUID(),
      name: errType.cause.name,
      message: errType.cause.message,
      stack: [`${errType.cause.name}: ${errType.cause.message}`],
    };
  }

  return { error, stackFrames };
}

function buildLog(appConfig, minutesAgo) {
  const { app, platform, entityType, environment, release, sdk } = appConfig;
  const level = pick(LEVELS);
  const isError = level === 'error' || level === 'fatal';
  const route = pick(ROUTES);
  const timestamp = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const requestId = randomUUID();
  const traceId = randomUUID().replace(/-/g, '');
  const spanId = randomUUID().replace(/-/g, '').slice(0, 16);
  const userId = `usr_${randomBetween(1, 40)}`;
  const responseTime = randomBetween(20, 900);
  const statusCode = isError ? pick([500, 502, 503]) : route.statusCode;

  const doc = {
    id: randomUUID(),
    '@timestamp': timestamp,
    timestamp,
    level,
    platform,
    app,
    environment,
    release,
    version: release,
    source: app,
    type: 'application',
    method: route.method,
    statusCode,
    durationMs: responseTime,
    priority: isError ? (level === 'fatal' ? 1 : 2) : 3,
    message: isError ? undefined : `${route.method} ${route.url} handled successfully`,

    entity: {
      id: `${app}-${entityType}`,
      name: app,
      type: entityType,
      version: release,
      environment,
      component: pick(['router', 'controller', 'service', 'middleware']),
    },

    user: {
      id: userId,
      email: `user${userId.replace('usr_', '')}@example.com`,
      sessionId: `sess_${randomBetween(1000, 9999)}`,
      ip: `10.0.${randomBetween(0, 255)}.${randomBetween(0, 255)}`,
      device: platform,
    },

    request: {
      id: requestId,
      url: route.url,
      method: route.method,
      userAgent: platform === 'ios'
        ? `DeepEyes/${release} (iPhone; iOS 17.4.1)`
        : platform === 'web'
          ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          : 'node-fetch/1.0',
      ip: `10.0.${randomBetween(0, 255)}.${randomBetween(0, 255)}`,
      correlationId: randomUUID(),
    },

    response: {
      statusCode,
      responseTimeMs: responseTime,
    },

    http: {
      method: route.method,
      url: route.url,
      statusCode,
      responseTime,
      queryString: Math.random() > 0.6 ? `page=${randomBetween(1, 5)}&limit=20` : '',
      bodySize: randomBetween(100, 4000),
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
      },
    },

    trace: {
      traceId,
      spanId,
      traceFlags: 1,
    },

    device: DEVICE_BY_PLATFORM[platform](),

    sdk,

    tags: [environment, platform, route.method.toLowerCase()],

    attributes: {
      route: route.url,
      'http.method': route.method,
      retryCount: isError ? randomBetween(0, 3) : 0,
    },

    breadcrumbs: buildBreadcrumbs(timestamp, route),
  };

  if (isError) {
    const errType = pick(ERROR_TYPES);
    doc.message = `${errType.name}: ${errType.message}`;
    doc.fingerprint = `${platform}:${errType.name}:${app}`;
    const { error, stackFrames } = buildError(errType, app);
    doc.error = error;
    doc.stackFrames = stackFrames;
    doc.breadcrumbs.push({
      timestamp,
      type: 'error',
      category: 'exception',
      message: `${errType.name}: ${errType.message}`,
      level: 'error',
      data: { handled: level !== 'fatal' },
    });
  }

  return doc;
}

async function main() {
  // The built-in x-pack "logs" template (priority 100, pattern logs-*-*) maps
  // "timestamp" as keyword, which breaks the app's `now-1h` style range queries.
  // Register a higher-priority template so our data stream keeps it as a date.
  await client.indices.putIndexTemplate({
    name: 'logs_test_development_template',
    index_patterns: [INDEX],
    priority: 200,
    data_stream: {},
    template: {
      mappings: {
        properties: {
          timestamp: { type: 'date' },
          level: { type: 'keyword' },
          platform: { type: 'keyword' },
          app: { type: 'keyword' },
          environment: { type: 'keyword' },
          fingerprint: { type: 'keyword' },
        },
      },
    },
  });

  const exists = await client.indices.exists({ index: INDEX });
  if (!exists) {
    await client.indices.createDataStream({ name: INDEX });
    console.log(`Created data stream ${INDEX}`);
  }

  const operations = [];
  let count = 0;
  for (const appConfig of APPS) {
    for (let minutesAgo = 0; minutesAgo < 24 * 60; minutesAgo += randomBetween(2, 6)) {
      const doc = buildLog(appConfig, minutesAgo);
      operations.push({ create: { _index: INDEX } });
      operations.push(doc);
      count++;
    }
  }

  const bulkResponse = await client.bulk({ refresh: true, operations });
  if (bulkResponse.errors) {
    const failed = bulkResponse.items.filter((i) => (i.create || i.index) && (i.create || i.index).error);
    console.error(`Bulk insert had ${failed.length} errors, e.g.:`, JSON.stringify(failed[0], null, 2));
    process.exit(1);
  }

  console.log(`Indexed ${count} logs into ${INDEX}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
