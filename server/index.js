
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ExasolDriver } from '@exasol/exasol-driver-ts';
import { WebSocket } from 'ws';
import { readFile } from 'node:fs/promises';
import { createAiChatRouter } from './aiChat.js';

const exasolCA = await readFile(
  new URL('./exasol-server.pem', import.meta.url),
  'utf8'
);

const app = express();
const PORT = Number(process.env.PORT || 4000);
const SCHEMA = 'KERVYN';

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

if (process.env.FRONTEND_ORIGIN) {
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN }));
}

// ------------------------------------------------------
// 1. DATABASE CONNECTION
// ------------------------------------------------------

const requiredEnv = [
  'EXASOL_HOST',
  'EXASOL_USER',
  'EXASOL_PASSWORD',
];

for (const name of requiredEnv) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const driver = new ExasolDriver(
  (url) =>
    new WebSocket(url, {
      rejectUnauthorized: true,
      ca: exasolCA,
    }),
  {
    host: process.env.EXASOL_HOST,
    port: Number(process.env.EXASOL_PORT || 8563),
    user: process.env.EXASOL_USER,
    password: process.env.EXASOL_PASSWORD,
  }
);

let connected = false;
let connecting = null;
let closing = false;

// Serialize operations because this implementation uses one connection.
let queue = Promise.resolve();

async function connectDB() {
  if (connected) return;

  if (!connecting) {
    connecting = driver.connect()
      .then(() => {
        connected = true;
      })
      .finally(() => {
        connecting = null;
      });
  }

  await connecting;
}

function db(sql) {
  const operation = queue.then(async () => {
    if (closing) throw new Error('Database connection is closing.');

    await connectDB();

    const result = await driver.query(sql);
    return result.getRows();
  });

  queue = operation.catch(() => {});
  return operation;
}

// ------------------------------------------------------
// 2. TABLE DEFINITIONS AND FIELD ALLOWLISTS
// ------------------------------------------------------

// These are logical key definitions. Your supplied DDL does
// not itself declare PRIMARY KEY or UNIQUE constraints.

const tables = {
  products: {
    name: 'PRODUCT',
    pk: 'PRODUCT_ID',
    fields: {
      PRODUCT_ID: 'int',
      PRODUCT_CODE: 'string',
      PRODUCT_NAME: 'string',
      REVISION: 'string',
      CREATED_AT: 'timestamp',
    },
  },

  stages: {
    name: 'PROCESS_STAGE',
    pk: 'STAGE_ID',
    fields: {
      STAGE_ID: 'int',
      STAGE_NAME: 'string',
      STAGE_SEQUENCE: 'int',
      STAGE_CATEGORY: 'string',
    },
  },

  defectTypes: {
    name: 'DEFECT_TYPE',
    pk: 'DEFECT_ID',
    fields: {
      DEFECT_ID: 'int',
      DEFECT_CODE: 'string',
      DEFECT_NAME: 'string',
      DEFECT_CATEGORY: 'string',
      SEVERITY: 'string',
    },
  },

  machines: {
    name: 'MACHINE',
    pk: 'MACHINE_ID',
    fields: {
      MACHINE_ID: 'int',
      MACHINE_CODE: 'string',
      MACHINE_TYPE: 'string',
      LINE_ID: 'string',
      LOCATION: 'string',
    },
  },

  workOrders: {
    name: 'WORK_ORDER',
    pk: 'WORK_ORDER_ID',
    fields: {
      WORK_ORDER_ID: 'bigint',
      WORK_ORDER_CODE: 'string',
      PRODUCT_ID: 'int',
      PLANNED_QTY: 'int',
      STARTED_AT: 'timestamp',
      COMPLETED_AT: 'timestamp',
      ORDER_STATUS: 'string',
    },
  },

  boards: {
    name: 'BOARD_UNIT',
    pk: 'BOARD_ID',
    fields: {
      BOARD_ID: 'bigint',
      SERIAL_NUMBER: 'string',
      WORK_ORDER_ID: 'bigint',
      PRODUCT_ID: 'int',
      REVISION: 'string',
      CREATED_AT: 'timestamp',
      CURRENT_STATUS: 'string',
    },
  },

  processEvents: {
    name: 'PROCESS_EVENT',
    pk: 'EVENT_ID',
    fields: {
      EVENT_ID: 'bigint',
      BOARD_ID: 'bigint',
      STAGE_ID: 'int',
      MACHINE_ID: 'int',
      EVENT_TIME: 'timestamp',
      OPERATOR_ID: 'string',
      LOT_CODE: 'string',
      TEMPERATURE_C: 'decimal',
      PROCESS_DURATION_SEC: 'decimal',
      PARAMETER_JSON: 'string',
      EVENT_STATUS: 'string',
    },
  },

  inspections: {
    name: 'INSPECTION_RESULT',
    pk: 'INSPECTION_ID',
    fields: {
      INSPECTION_ID: 'bigint',
      BOARD_ID: 'bigint',
      STAGE_ID: 'int',
      MACHINE_ID: 'int',
      INSPECTION_TIME: 'timestamp',
      INSPECTION_TYPE: 'string',
      INSPECTION_STATUS: 'string',
      MEASURED_VALUE: 'decimal',
      MEASUREMENT_UNIT: 'string',
      LOWER_LIMIT: 'decimal',
      UPPER_LIMIT: 'decimal',
      TEST_CODE: 'string',
      TEST_DETAILS: 'string',
    },
  },

  defects: {
    name: 'DEFECT_EVENT',
    pk: 'DEFECT_EVENT_ID',
    fields: {
      DEFECT_EVENT_ID: 'bigint',
      BOARD_ID: 'bigint',
      INSPECTION_ID: 'bigint',
      DEFECT_ID: 'int',
      DETECTED_STAGE_ID: 'int',
      SUSPECTED_ORIGIN_STAGE_ID: 'int',
      CONFIRMED_ORIGIN_STAGE_ID: 'int',
      DETECTED_AT: 'timestamp',
      DEFECT_COUNT: 'int',
      SEVERITY: 'string',
      ROOT_CAUSE_STATUS: 'string',
      ROOT_CAUSE_NOTES: 'string',
      DISPOSITION: 'string',
    },
  },

    rework: {
    name: 'REWORK_EVENT',
    pk: 'REWORK_ID',
    fields: {
        REWORK_ID: 'bigint',
        BOARD_ID: 'bigint',
        DEFECT_EVENT_ID: 'bigint',
        REWORK_STAGE_ID: 'int',
        REWORK_TIME: 'timestamp',
        ACTION_TAKEN: 'string',
        REWORK_COST: 'decimal',
        RETEST_RESULT: 'string',
        CLOSED_AT: 'timestamp',
    },
    },
};

function tableFor(resource) {
  const table = tables[resource];

  if (!table) {
    const error = new Error('Unknown resource.');
    error.status = 404;
    throw error;
  }

  return table;
}

function identifier(name) {
  // Only fixed identifiers from our server-side allowlists
  // should reach this function.
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
    throw new Error('Invalid SQL identifier.');
  }

  return `"${name}"`;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlValue(value, type) {
  if (value === null) return 'NULL';

  if (value === undefined) {
    throw new Error('Undefined values are not allowed.');
  }

  if (type === 'int' || type === 'bigint' || type === 'decimal') {
    // Keep large IDs as strings in JavaScript when necessary.
    const text = String(value);

    if (!/^-?\d+(\.\d+)?$/.test(text) || !Number.isFinite(Number(text))) {
      throw new Error(`Invalid numeric value: ${text}`);
    }

    if (type === 'int' && !Number.isSafeInteger(Number(text))) {
      throw new Error(`Invalid integer value: ${text}`);
    }

    if (type === 'bigint' && !/^-?\d+$/.test(text)) {
      throw new Error(`Invalid BIGINT value: ${text}`);
    }

    return text;
  }

  if (type === 'timestamp') {
    const text = String(value);

    // Require a valid date/time string before quoting it.
    if (Number.isNaN(Date.parse(text))) {
      throw new Error(`Invalid timestamp: ${text}`);
    }

    return sqlString(text);
  }

  if (type === 'string') {
    if (typeof value !== 'string') {
      throw new Error('String fields must contain strings or null.');
    }

    return sqlString(value);
  }

  throw new Error('Unsupported field type.');
}

function normalizeInput(table, body, { allowPrimaryKey = true } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Request body must be a JSON object.');
    error.status = 400;
    throw error;
  }

  const entries = [];

  for (const [key, value] of Object.entries(body)) {
    const column = key.toUpperCase();

    if (!Object.hasOwn(table.fields, column)) {
      const error = new Error(`Unknown field: ${key}`);
      error.status = 400;
      throw error;
    }

    if (!allowPrimaryKey && column === table.pk) {
      const error = new Error('The record key cannot be changed.');
      error.status = 400;
      throw error;
    }

    entries.push({
      column,
      value: sqlValue(value, table.fields[column]),
    });
  }

  if (!entries.length) {
    const error = new Error('At least one field is required.');
    error.status = 400;
    throw error;
  }

  return entries;
}

function keyValue(table, rawId) {
  if (rawId === undefined || rawId === '') {
    const error = new Error('A record ID is required.');
    error.status = 400;
    throw error;
  }

  const type = table.fields[table.pk];
  return sqlValue(rawId, type);
}

function camelCaseRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()),
      value,
    ])
  );
}

function sendError(res, error) {
  console.error('API/database error:', error);

  if (res.headersSent) return;

  res.status(500).json({
    error: 'An internal server or database error occurred.',
  });
}

// ------------------------------------------------------
// 3. HEALTH AND DISCOVERY
// ------------------------------------------------------

app.get('/api/health', async (_req, res) => {
    try {
    const rows = await db('SELECT CURRENT_TIMESTAMP AS DB_TIME');

    res.json({
      status: 'ok',
      database: SCHEMA,
      databaseTime: rows[0]?.DB_TIME ?? null,
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/tables', (_req, res) => {
  res.json({
    resources: Object.entries(tables).map(([resource, table]) => ({
      resource,
      table: table.name,
      primaryKey: table.pk,
      fields: Object.keys(table.fields),
    })),
});
});

// ------------------------------------------------------
// 4. CRUD API
// ------------------------------------------------------

// GET /api/products?limit=50&offset=0
// GET /api/products/123
// POST /api/products
// PUT /api/products/123
// DELETE /api/products/123

app.get('/api/analytics', async (req, res) => {
  try {
    const daysInput = Number.parseInt(req.query.days || '60', 10);
    const days = Number.isInteger(daysInput)
      ? Math.max(1, Math.min(daysInput, 90))
      : 14;

    const stage = String(req.query.stage || 'all');

    let stageId = null;

    if (stage.toLowerCase() !== 'all') {
      const stageRows = await db(`
        SELECT STAGE_ID
        FROM ${SCHEMA}.PROCESS_STAGE
        WHERE STAGE_NAME = ${sqlString(stage)}
      `);

      if (!stageRows.length) {
        return res.status(400).json({ error: 'Unknown process stage.' });
      }

      stageId = Number(stageRows[0].STAGE_ID);
    }

    const inspectionFilter = stageId === null
      ? ''
      : ` AND STAGE_ID = ${stageId}`;

    const recordsInspectionFilter = stageId === null
      ? ''
      : ` AND i.STAGE_ID = ${stageId}`;

    const defectFilter = stageId === null
      ? ''
      : ` AND DETECTED_STAGE_ID = ${stageId}`;

    const reworkFilter = stageId === null
      ? ''
      : ` AND REWORK_STAGE_ID = ${stageId}`;

    const processFilter = stageId === null
      ? ''
      : ` AND STAGE_ID = ${stageId}`;

    const metricRows = await db(`
      WITH
      inspection_stats AS (
        SELECT
          COUNT(*) AS INSPECTION_COUNT,
          COUNT(DISTINCT BOARD_ID) AS BOARDS_INSPECTED,
          SUM(CASE WHEN UPPER(INSPECTION_STATUS) = 'PASS'
                   THEN 1 ELSE 0 END) AS PASSED_TESTS,
          SUM(CASE WHEN UPPER(INSPECTION_STATUS) = 'FAIL'
                   THEN 1 ELSE 0 END) AS FAILED_TESTS
        FROM ${SCHEMA}.INSPECTION_RESULT
        WHERE INSPECTION_TIME >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
          ${inspectionFilter}
      ),
      first_checks AS (
        SELECT BOARD_ID, STAGE_ID, INSPECTION_STATUS,
          ROW_NUMBER() OVER (
            PARTITION BY BOARD_ID, STAGE_ID
            ORDER BY INSPECTION_TIME, INSPECTION_ID
          ) AS RN
        FROM ${SCHEMA}.INSPECTION_RESULT
        WHERE INSPECTION_TIME >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
          ${inspectionFilter}
      ),
      first_pass AS (
        SELECT
          COUNT(*) AS FIRST_CHECKS,
          SUM(CASE WHEN UPPER(INSPECTION_STATUS) = 'PASS'
                   THEN 1 ELSE 0 END) AS FIRST_PASSES
        FROM first_checks
        WHERE RN = 1
      ),
      measurement_stats AS (
        SELECT
          COUNT(*) AS MEASUREMENTS,
          SUM(CASE
            WHEN (LOWER_LIMIT IS NOT NULL AND MEASURED_VALUE < LOWER_LIMIT)
              OR (UPPER_LIMIT IS NOT NULL AND MEASURED_VALUE > UPPER_LIMIT)
            THEN 1 ELSE 0
          END) AS OUT_OF_SPEC
        FROM ${SCHEMA}.INSPECTION_RESULT
        WHERE INSPECTION_TIME >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
          AND MEASURED_VALUE IS NOT NULL
          AND (LOWER_LIMIT IS NOT NULL OR UPPER_LIMIT IS NOT NULL)
          ${inspectionFilter}
      ),
      defect_stats AS (
        SELECT
          COUNT(*) AS DEFECT_EVENTS,
          COALESCE(SUM(DEFECT_COUNT), 0) AS DEFECT_COUNT,
          COUNT(DISTINCT BOARD_ID) AS AFFECTED_BOARDS,
          SUM(CASE WHEN UPPER(COALESCE(SEVERITY, '')) = 'CRITICAL'
                   THEN 1 ELSE 0 END) AS CRITICAL_EVENTS,
          SUM(CASE
            WHEN CONFIRMED_ORIGIN_STAGE_ID IS NOT NULL
             AND UPPER(COALESCE(ROOT_CAUSE_STATUS, ''))
                 IN ('CONFIRMED', 'CLOSED')
            THEN 1 ELSE 0 END) AS CONFIRMED_ORIGINS
        FROM ${SCHEMA}.DEFECT_EVENT
        WHERE DETECTED_AT >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
          ${defectFilter}
      ),
      rework_stats AS (
        SELECT
          COUNT(*) AS REWORK_EVENTS,
          COUNT(DISTINCT BOARD_ID) AS REWORKED_BOARDS,
          COALESCE(SUM(REWORK_COST), 0) AS REWORK_COST,
          SUM(CASE WHEN UPPER(COALESCE(RETEST_RESULT, '')) = 'PASS'
                   THEN 1 ELSE 0 END) AS RETEST_PASSES,
          COUNT(RETEST_RESULT) AS RETESTS
        FROM ${SCHEMA}.REWORK_EVENT
        WHERE REWORK_TIME >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
          ${reworkFilter}
      ),
      process_stats AS (
        SELECT
          AVG(PROCESS_DURATION_SEC) AS AVG_DURATION_SEC,
          AVG(TEMPERATURE_C) AS AVG_TEMPERATURE_C
        FROM ${SCHEMA}.PROCESS_EVENT
        WHERE EVENT_TIME >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
          ${processFilter}
      ),
      production_stats AS (
        SELECT
          COUNT(*) AS TOTAL_BOARDS,
          SUM(CASE WHEN UPPER(COALESCE(CURRENT_STATUS, ''))
                    IN ('PASS', 'COMPLETED', 'COMPLETE')
                   THEN 1 ELSE 0 END) AS COMPLETED_BOARDS
        FROM ${SCHEMA}.BOARD_UNIT
      ),
      order_stats AS (
        SELECT
          COUNT(*) AS TOTAL_ORDERS,
          COALESCE(SUM(PLANNED_QTY), 0) AS PLANNED_QTY,
          SUM(CASE WHEN UPPER(COALESCE(ORDER_STATUS, ''))
                    IN ('COMPLETED', 'COMPLETE', 'CLOSED')
                   THEN 1 ELSE 0 END) AS COMPLETED_ORDERS
        FROM ${SCHEMA}.WORK_ORDER
      )
      SELECT
        i.*, f.*, ms.*, d.*, r.*, ps.*, p.*, o.*
      FROM inspection_stats i
      CROSS JOIN first_pass f
      CROSS JOIN measurement_stats ms
      CROSS JOIN defect_stats d
      CROSS JOIN rework_stats r
      CROSS JOIN process_stats ps
      CROSS JOIN production_stats p
      CROSS JOIN order_stats o
    `);

    const m = metricRows[0] || {};
    const n = (key) => Number(m[key] ?? 0);
    const pct = (a, b) =>
      b > 0 ? Number(((a / b) * 100).toFixed(2)) : null;

    const stages = await db(`
      WITH inspection_by_stage AS (
        SELECT
          STAGE_ID,
          COUNT(DISTINCT BOARD_ID) AS INSPECTED,
          COUNT(DISTINCT CASE WHEN UPPER(INSPECTION_STATUS) = 'PASS'
                              THEN BOARD_ID END) AS PASSED,
          COUNT(DISTINCT CASE WHEN UPPER(INSPECTION_STATUS) = 'FAIL'
                              THEN BOARD_ID END) AS FAILED
        FROM ${SCHEMA}.INSPECTION_RESULT
        WHERE INSPECTION_TIME >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
          ${inspectionFilter}
        GROUP BY STAGE_ID
      ),
      defect_by_stage AS (
        SELECT
          DETECTED_STAGE_ID AS STAGE_ID,
          COUNT(*) AS DEFECT_EVENTS,
          COALESCE(SUM(DEFECT_COUNT), 0) AS DEFECT_COUNT
        FROM ${SCHEMA}.DEFECT_EVENT
        WHERE DETECTED_AT >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
          ${defectFilter}
        GROUP BY DETECTED_STAGE_ID
      )
      SELECT
        s.STAGE_NAME,
        COALESCE(i.INSPECTED, 0) AS INSPECTED,
        COALESCE(i.PASSED, 0) AS PASSED,
        COALESCE(i.FAILED, 0) AS FAILED,
        COALESCE(d.DEFECT_EVENTS, 0) AS DEFECT_EVENTS,
        COALESCE(d.DEFECT_COUNT, 0) AS DEFECT_COUNT
      FROM ${SCHEMA}.PROCESS_STAGE s
      LEFT JOIN inspection_by_stage i ON i.STAGE_ID = s.STAGE_ID
      LEFT JOIN defect_by_stage d ON d.STAGE_ID = s.STAGE_ID
      WHERE ${stageId === null ? '1=1' : `s.STAGE_ID = ${stageId}`}
      ORDER BY s.STAGE_SEQUENCE
    `);

    const defects = await db(`
      SELECT
        COALESCE(t.DEFECT_NAME, 'Unknown defect') AS DEFECT_NAME,
        COALESCE(d.SEVERITY, t.SEVERITY, 'Unknown') AS SEVERITY,
        COUNT(*) AS EVENT_COUNT,
        COALESCE(SUM(d.DEFECT_COUNT), 0) AS DEFECT_COUNT
      FROM ${SCHEMA}.DEFECT_EVENT d
      LEFT JOIN ${SCHEMA}.DEFECT_TYPE t ON t.DEFECT_ID = d.DEFECT_ID
      WHERE d.DETECTED_AT >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
        ${defectFilter}
      GROUP BY t.DEFECT_NAME, d.SEVERITY, t.SEVERITY
      ORDER BY DEFECT_COUNT DESC
    `);

    const trend = await db(`
      WITH daily_inspections AS (
        SELECT CAST(INSPECTION_TIME AS DATE) AS DAY_DATE,
          COUNT(DISTINCT BOARD_ID) AS INSPECTED
        FROM ${SCHEMA}.INSPECTION_RESULT
        WHERE INSPECTION_TIME >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
          ${inspectionFilter}
        GROUP BY CAST(INSPECTION_TIME AS DATE)
      ),
      daily_defects AS (
        SELECT CAST(DETECTED_AT AS DATE) AS DAY_DATE,
          COALESCE(SUM(DEFECT_COUNT), 0) AS DEFECTS
        FROM ${SCHEMA}.DEFECT_EVENT
        WHERE DETECTED_AT >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
          ${defectFilter}
        GROUP BY CAST(DETECTED_AT AS DATE)
      )
      SELECT
        TO_CHAR(COALESCE(i.DAY_DATE, d.DAY_DATE), 'YYYY-MM-DD') AS DAY_LABEL,
        COALESCE(i.INSPECTED, 0) AS INSPECTED,
        COALESCE(d.DEFECTS, 0) AS DEFECTS
      FROM daily_inspections i
      FULL OUTER JOIN daily_defects d ON i.DAY_DATE = d.DAY_DATE
      ORDER BY COALESCE(i.DAY_DATE, d.DAY_DATE)
    `);

    const records = await db(`
      SELECT
        i.INSPECTION_ID,
        b.SERIAL_NUMBER,
        p.PRODUCT_CODE,
        p.PRODUCT_NAME,
        b.REVISION,
        s.STAGE_NAME,
        i.INSPECTION_TYPE,
        i.INSPECTION_STATUS,
        i.MEASURED_VALUE,
        i.MEASUREMENT_UNIT,
        i.LOWER_LIMIT,
        i.UPPER_LIMIT,
        i.TEST_CODE,
        i.INSPECTION_TIME
      FROM ${SCHEMA}.INSPECTION_RESULT i
      LEFT JOIN ${SCHEMA}.BOARD_UNIT b ON b.BOARD_ID = i.BOARD_ID
      LEFT JOIN ${SCHEMA}.PRODUCT p ON p.PRODUCT_ID = b.PRODUCT_ID
      LEFT JOIN ${SCHEMA}.PROCESS_STAGE s ON s.STAGE_ID = i.STAGE_ID
      WHERE i.INSPECTION_TIME >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
        ${recordsInspectionFilter}
      ORDER BY i.INSPECTION_TIME DESC
      LIMIT 100
    `);

    const machines = await db(`
      SELECT
        m.MACHINE_CODE,
        m.MACHINE_TYPE,
        m.LINE_ID,
        COUNT(e.EVENT_ID) AS PROCESS_EVENTS,
        AVG(e.PROCESS_DURATION_SEC) AS AVG_DURATION_SEC,
        AVG(e.TEMPERATURE_C) AS AVG_TEMPERATURE_C
      FROM ${SCHEMA}.MACHINE m
      LEFT JOIN ${SCHEMA}.PROCESS_EVENT e
        ON e.MACHINE_ID = m.MACHINE_ID
        AND e.EVENT_TIME >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
        ${stageId === null ? '' : `AND e.STAGE_ID = ${stageId}`}
      GROUP BY m.MACHINE_ID, m.MACHINE_CODE, m.MACHINE_TYPE, m.LINE_ID
      ORDER BY PROCESS_EVENTS DESC
    `);

    const confirmedOrigins = await db(`
      SELECT
        COALESCE(s.STAGE_NAME, 'Unknown stage') AS STAGE_NAME,
        COUNT(*) AS CONFIRMED_EVENTS,
        COALESCE(SUM(d.DEFECT_COUNT), 0) AS DEFECT_COUNT
      FROM ${SCHEMA}.DEFECT_EVENT d
      LEFT JOIN ${SCHEMA}.PROCESS_STAGE s
        ON s.STAGE_ID = d.CONFIRMED_ORIGIN_STAGE_ID
      WHERE d.CONFIRMED_ORIGIN_STAGE_ID IS NOT NULL
        AND UPPER(COALESCE(d.ROOT_CAUSE_STATUS, ''))
            IN ('CONFIRMED', 'CLOSED')
        AND d.DETECTED_AT >= ADD_DAYS(CURRENT_TIMESTAMP, -${days})
        ${defectFilter}
      GROUP BY s.STAGE_NAME
      ORDER BY CONFIRMED_EVENTS DESC
    `);

    const boardStatuses = await db(`
      SELECT CURRENT_STATUS, COUNT(*) AS BOARD_COUNT
      FROM ${SCHEMA}.BOARD_UNIT
      GROUP BY CURRENT_STATUS
      ORDER BY BOARD_COUNT DESC
    `);

    const inspectionsDenominator = n('PASSED_TESTS') + n('FAILED_TESTS');

    res.json({
      updatedAt: new Date().toISOString(),
      periodDays: days,

      metrics: {
        totalBoards: n('TOTAL_BOARDS'),
        completedBoards: n('COMPLETED_BOARDS'),
        totalInspected: n('BOARDS_INSPECTED'),
        inspectionCount: n('INSPECTION_COUNT'),

        passRate: pct(n('PASSED_TESTS'), inspectionsDenominator),
        failureRate: pct(n('FAILED_TESTS'), inspectionsDenominator),
        firstPassYield: pct(n('FIRST_PASSES'), n('FIRST_CHECKS')),

        totalDefects: n('DEFECT_COUNT'),
        defectEvents: n('DEFECT_EVENTS'),
        criticalDefects: n('CRITICAL_EVENTS'),
        affectedBoards: n('AFFECTED_BOARDS'),
        boardDefectRate: pct(n('AFFECTED_BOARDS'), n('BOARDS_INSPECTED')),

        measurementCount: n('MEASUREMENTS'),
        outOfSpecMeasurements: n('OUT_OF_SPEC'),
        outOfSpecRate: pct(n('OUT_OF_SPEC'), n('MEASUREMENTS')),

        reworkEvents: n('REWORK_EVENTS'),
        reworkedBoards: n('REWORKED_BOARDS'),
        reworkRate: pct(n('REWORKED_BOARDS'), n('BOARDS_INSPECTED')),
        reworkCost: n('REWORK_COST'),
        retestPassRate: pct(n('RETEST_PASSES'), n('RETESTS')),

        avgCycleTime: n('AVG_DURATION_SEC') / 60,
        avgProcessDurationSec: n('AVG_DURATION_SEC'),
        avgTemperatureC: m.AVG_TEMPERATURE_C == null
          ? null
          : n('AVG_TEMPERATURE_C'),

        totalOrders: n('TOTAL_ORDERS'),
        plannedQuantity: n('PLANNED_QTY'),
        completedOrders: n('COMPLETED_ORDERS'),
        orderCompletionRate: pct(n('COMPLETED_ORDERS'), n('TOTAL_ORDERS')),
        confirmedOriginEvents: n('CONFIRMED_ORIGINS'),
      },

      stages: stages.map((r) => ({
        stageName: r.STAGE_NAME,
        inspected: Number(r.INSPECTED || 0),
        passed: Number(r.PASSED || 0),
        failed: Number(r.FAILED || 0),
        defectEvents: Number(r.DEFECT_EVENTS || 0),
        defectCount: Number(r.DEFECT_COUNT || 0),
        defectRate: pct(
          Number(r.FAILED || 0),
          Number(r.INSPECTED || 0)
        ),
      })),

      defects: defects.map((r) => ({
        name: r.DEFECT_NAME,
        severity: r.SEVERITY,
        count: Number(r.DEFECT_COUNT || 0),
        events: Number(r.EVENT_COUNT || 0),
      })),

      trend: trend.map((r) => ({
        label: r.DAY_LABEL,
        inspected: Number(r.INSPECTED || 0),
        defects: Number(r.DEFECTS || 0),
      })),

      records: records.map(camelCaseRow),

      machines: machines.map((r) => ({
        machineCode: r.MACHINE_CODE,
        machineType: r.MACHINE_TYPE,
        lineId: r.LINE_ID,
        processEvents: Number(r.PROCESS_EVENTS || 0),
        avgDurationSec: r.AVG_DURATION_SEC == null
          ? null : Number(r.AVG_DURATION_SEC),
        avgTemperatureC: r.AVG_TEMPERATURE_C == null
          ? null : Number(r.AVG_TEMPERATURE_C),
      })),

      confirmedOrigins: confirmedOrigins.map((r) => ({
        stageName: r.STAGE_NAME,
        confirmedEvents: Number(r.CONFIRMED_EVENTS || 0),
        defectCount: Number(r.DEFECT_COUNT || 0),
      })),

      boardStatuses: boardStatuses.map((r) => ({
        status: r.CURRENT_STATUS || 'Unknown',
        count: Number(r.BOARD_COUNT || 0),
      })),
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.use('/api/ai', createAiChatRouter({ db }));

app.get('/api/:resource', async (req, res) => {
  try {
    const table = tableFor(req.params.resource);
    const limit = Math.min(
        200,
        Math.max(1, Number.parseInt(req.query.limit || '50', 10) || 50)
    );
    const offset = Math.max(
      0,
      Number.parseInt(req.query.offset || '0', 10) || 0
    );
    
    const rows = await db(`
        SELECT *
        FROM ${SCHEMA}.${identifier(table.name)}
        ORDER BY ${identifier(table.pk)}
        LIMIT ${limit}
        OFFSET ${offset}
        `);
        
        res.json({
            data: rows.map(camelCaseRow),
            pagination: { limit, offset, returned: rows.length },
        });
    console.log('[API first raw row]', rows[0]);
    } catch (error) {
        sendError(res, error);
    }
});

app.get('/api/:resource/:id', async (req, res) => {
  try {
    const table = tableFor(req.params.resource);
    const id = keyValue(table, req.params.id);

    const rows = await db(`
      SELECT *
      FROM ${SCHEMA}.${identifier(table.name)}
      WHERE ${identifier(table.pk)} = ${id}
    `);

    if (!rows.length) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    res.json({ data: camelCaseRow(rows[0]) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/:resource', async (req, res) => {
  try {
    const table = tableFor(req.params.resource);
    const entries = normalizeInput(table, req.body);

    const columns = entries.map((entry) => identifier(entry.column)).join(', ');
    const values = entries.map((entry) => entry.value).join(', ');

    await db(`
      INSERT INTO ${SCHEMA}.${identifier(table.name)}
        (${columns})
      VALUES (${values})
    `);

    res.status(201).json({
      message: 'Record inserted successfully.',
      resource: req.params.resource,
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.put('/api/:resource/:id', async (req, res) => {
  try {
    const table = tableFor(req.params.resource);
    const id = keyValue(table, req.params.id);
    const entries = normalizeInput(table, req.body, {
      allowPrimaryKey: false,
    });

    const assignments = entries
      .map(({ column, value }) => `${identifier(column)} = ${value}`)
      .join(', ');

    await db(`
      UPDATE ${SCHEMA}.${identifier(table.name)}
      SET ${assignments}
      WHERE ${identifier(table.pk)} = ${id}
    `);

    res.json({ message: 'Update executed successfully.' });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete('/api/:resource/:id', async (req, res) => {
  try {
    const table = tableFor(req.params.resource);
    const id = keyValue(table, req.params.id);

    await db(`
      DELETE FROM ${SCHEMA}.${identifier(table.name)}
      WHERE ${identifier(table.pk)} = ${id}
    `);

    res.json({ message: 'Delete executed successfully.' });
  } catch (error) {
    sendError(res, error);
  }
});

// ------------------------------------------------------
// 5. MANUFACTURING ANALYTICS
// ------------------------------------------------------


// ------------------------------------------------------
// 6. NOT FOUND AND ERROR HANDLERS
// ------------------------------------------------------

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON request body.' });
  }

  sendError(res, error);
});

// ------------------------------------------------------
// 7. STARTUP AND SHUTDOWN
// ------------------------------------------------------

const server = app.listen(PORT, () => {
  console.log(`Kervyn API running at http://localhost:${PORT}`);
  console.log(`Available resources: ${Object.keys(tables).join(', ')}`);
});

async function shutdown() {
  if (closing) return;
  closing = true;

  server.close(async () => {
    try {
      await queue;

      if (connected) {
        await driver.close();
        connected = false;
      }
    } catch (error) {
      console.error('Shutdown error:', error.message);
    } finally {
      process.exit(0);
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
