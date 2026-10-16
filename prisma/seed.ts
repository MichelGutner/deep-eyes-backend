import { PrismaClient, Prisma } from '../node_modules/.prisma/client';

const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function hash(password: string) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(10));
}

const APPS = [
  { name: 'deep-eyes-web', environment: 'production', version: '1.4.2' },
  { name: 'deep-eyes-api', environment: 'production', version: '2.0.1' },
  { name: 'deep-eyes-mobile', environment: 'staging', version: '0.9.0' },
];

async function main() {
  console.log('Seeding organization...');
  const org = await prisma.organization.upsert({
    where: { name: 'Deep Eyes Demo' },
    update: {},
    create: { name: 'Deep Eyes Demo', plan: 'PREMIUM_PLAN' },
  });

  console.log('Seeding users...');
  const usersData = [
    { email: 'admin@deepeyes.dev', name: 'Ana Owner', role: 'OWNER' as const, password: 'password123' },
    { email: 'dev@deepeyes.dev', name: 'Diego Admin', role: 'ADMIN' as const, password: 'password123' },
    { email: 'viewer@deepeyes.dev', name: 'Vitor Viewer', role: 'VIEWER' as const, password: 'password123' },
  ];
  for (const u of usersData) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        password_hash: hash(u.password),
        organization_id: org.id,
        lastActive: new Date(),
      },
    });
  }

  console.log('Seeding applications...');
  const apps: Awaited<ReturnType<typeof prisma.application.upsert>>[] = [];
  for (const a of APPS) {
    const app = await prisma.application.upsert({
      where: { name: a.name },
      update: {},
      create: { ...a, organization_id: org.id },
    });
    apps.push(app);
  }

  console.log('Seeding metrics + traces...');
  const now = Date.now();
  const metricRows: Prisma.MetricCreateManyInput[] = [];
  const traceRows: Prisma.TraceCreateManyInput[] = [];
  for (const app of apps) {
    for (let i = 0; i < 60; i++) {
      const ts = new Date(now - i * 60_000);
      metricRows.push({
        timestamp: ts,
        name: 'http.request.duration',
        value: Math.round(50 + Math.random() * 400),
        type: 'HISTOGRAM' as const,
        application_id: app.id,
        labels: { route: '/api/resource', method: 'GET' },
      });
      metricRows.push({
        timestamp: ts,
        name: 'process.cpu.usage',
        value: Math.round(Math.random() * 100 * 100) / 100,
        type: 'GAUGE' as const,
        application_id: app.id,
      });
    }
    for (let i = 0; i < 20; i++) {
      const start = new Date(now - i * 45_000);
      const duration = Math.round(10_000_000 + Math.random() * 200_000_000);
      traceRows.push({
        traceId: `trace-${app.id.slice(0, 8)}-${i}`,
        spanId: `span-${i}`,
        name: 'GET /api/resource',
        kind: 'SERVER' as const,
        start_time: start,
        end_time: new Date(start.getTime() + duration / 1_000_000),
        duration,
        status: i % 10 === 0 ? ('ERROR' as const) : ('OK' as const),
        application_id: app.id,
        attributes: { 'http.method': 'GET', 'http.status_code': i % 10 === 0 ? 500 : 200 },
      });
    }
  }
  await prisma.metric.createMany({ data: metricRows });
  await prisma.trace.createMany({ data: traceRows });

  console.log('Seeding alert rules + alerts...');
  const alertRules = await prisma.alertRule.createMany({
    data: [
      {
        name: 'High error rate',
        condition: 'error_rate > threshold',
        threshold: 5,
        metric: 'error_rate',
        severity: 'high',
        enabled: true,
        notifications: { email: true, slack: true, webhook: false },
      },
      {
        name: 'Latency spike',
        condition: 'p95_latency > threshold',
        threshold: 800,
        metric: 'p95_latency_ms',
        severity: 'medium',
        enabled: true,
        notifications: { email: true, slack: false, webhook: false },
      },
      {
        name: 'Low disk space',
        condition: 'disk_free < threshold',
        threshold: 10,
        metric: 'disk_free_pct',
        severity: 'critical',
        enabled: false,
        notifications: { email: true, slack: true, webhook: true },
      },
    ],
  });

  await prisma.alert.createMany({
    data: [
      {
        type: 'error_rate',
        title: 'Error rate above 5% on deep-eyes-api',
        message: 'Error rate reached 7.2% in the last 5 minutes.',
        severity: 'high',
        status: 'active',
        source: 'deep-eyes-api',
        tags: ['production', 'api'],
      },
      {
        type: 'latency',
        title: 'P95 latency spike on deep-eyes-web',
        message: 'P95 latency reached 1120ms.',
        severity: 'medium',
        status: 'acknowledged',
        source: 'deep-eyes-web',
        assignedTo: 'dev@deepeyes.dev',
        tags: ['production', 'web'],
      },
      {
        type: 'availability',
        title: 'deep-eyes-mobile health check failing',
        message: 'Health check failed 3 times consecutively.',
        severity: 'critical',
        status: 'resolved',
        source: 'deep-eyes-mobile',
        tags: ['staging', 'mobile'],
      },
    ],
  });

  console.log('Seeding incidents...');
  const incident = await prisma.incident.create({
    data: {
      title: 'Elevated 500s on checkout endpoint',
      description: 'Spike of internal server errors on POST /checkout affecting ~4% of requests.',
      severity: 'high',
      status: 'investigating',
      type: 'availability',
      assignee: 'dev@deepeyes.dev',
      reporter: 'admin@deepeyes.dev',
      affectedServices: ['deep-eyes-api'],
      impact: 'Some users unable to complete checkout.',
      tags: ['checkout', 'production'],
      automationStatus: 'manual',
    },
  });
  await prisma.incident.create({
    data: {
      title: 'Mobile app crash on startup (Android 12)',
      description: 'Native crash reported by several users on Android 12 devices right after launch.',
      severity: 'medium',
      status: 'resolved',
      type: 'infrastructure',
      assignee: 'dev@deepeyes.dev',
      reporter: 'viewer@deepeyes.dev',
      affectedServices: ['deep-eyes-mobile'],
      impact: 'App unusable for affected devices.',
      rootCause: 'Null pointer in native crash handler bridge.',
      resolution: 'Patched native bridge, shipped hotfix 0.9.1.',
      resolvedAt: new Date(now - 2 * 86_400_000),
      tags: ['mobile', 'crash'],
      automationStatus: 'semi_automated',
    },
  });
  await prisma.incidentComment.createMany({
    data: [
      { incidentId: incident.id, userId: 'admin@deepeyes.dev', description: 'Investigating logs from the last hour.' },
      { incidentId: incident.id, userId: 'dev@deepeyes.dev', description: 'Found correlation with a recent deploy at 14:02 UTC.' },
    ],
  });

  console.log('Seeding custom metrics...');
  await prisma.customMetric.createMany({
    data: [
      {
        name: 'Checkout conversion rate',
        description: 'Percentage of sessions completing checkout',
        type: 'gauge',
        unit: '%',
        query: 'level:info AND message:"checkout completed"',
        chartType: 'line',
        isActive: true,
      },
      {
        name: 'API error count',
        description: 'Count of error-level logs for deep-eyes-api',
        type: 'counter',
        unit: 'count',
        query: 'app:deep-eyes-api AND level:error',
        alertThreshold: 100,
        alertCondition: 'above',
        chartType: 'bar',
        isActive: true,
      },
    ],
  });

  console.log('Seeding dashboards + widgets...');
  const dashboard = await prisma.dashboard.create({
    data: {
      name: 'Overview',
      isPublic: false,
      widgets: {
        create: [
          { type: 'line_chart', title: 'Requests over time', config: { metric: 'requests' }, posX: 0, posY: 0, width: 6, height: 3 },
          { type: 'stat', title: 'Error rate', config: { metric: 'error_rate' }, posX: 6, posY: 0, width: 2, height: 3 },
          { type: 'table', title: 'Top endpoints', config: { metric: 'endpoints' }, posX: 0, posY: 3, width: 8, height: 4 },
        ],
      },
    },
  });

  console.log('Seeding organization settings...');
  await prisma.organizationSettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      notifications: { email: true, slack: false, webhook: false },
      security: { mfa: false, sessionTimeout: 480, ipWhitelist: [] },
      display: { theme: 'dark', timezone: 'America/Sao_Paulo', refreshInterval: 30, dateFormat: 'DD/MM/YYYY' },
    },
  });

  console.log('Seed summary:');
  console.log(`  organization: ${org.name} (${org.id})`);
  console.log(`  applications: ${apps.map((a) => `${a.name}=${a.apiKey}`).join(', ')}`);
  console.log(`  alert rules: ${alertRules.count}`);
  console.log(`  dashboard: ${dashboard.id}`);
  console.log('  users: admin@deepeyes.dev / dev@deepeyes.dev / viewer@deepeyes.dev (password: password123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
