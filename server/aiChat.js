import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';

const SARVAM_API_URL = 'https://api.sarvam.ai/v1/chat/completions';
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const MODEL = process.env.SARVAM_MODEL || 'sarvam-105b';

const SCHEMA = 'KERVYN';

const MAX_HISTORY = 12;
const MAX_SESSIONS = 500;
const MAX_ROWS = 40;
const MAX_MESSAGE_LENGTH = 8000;
const REQUEST_TIMEOUT_MS = 90_000;

const sessions = new Map();

// --------------------------------------------------
// Actual KERVYN schema from your uploaded index.js
// --------------------------------------------------

const TABLES = {
  PRODUCT: {
    alias: 'P',
    columns: [
      'PRODUCT_ID',
      'PRODUCT_CODE',
      'PRODUCT_NAME',
      'REVISION',
      'CREATED_AT',
    ],
  },

  PROCESS_STAGE: {
    alias: 'PS',
    columns: [
      'STAGE_ID',
      'STAGE_NAME',
      'STAGE_SEQUENCE',
      'STAGE_CATEGORY',
    ],
  },

  DEFECT_TYPE: {
    alias: 'DT',
    columns: [
      'DEFECT_ID',
      'DEFECT_CODE',
      'DEFECT_NAME',
      'DEFECT_CATEGORY',
      'SEVERITY',
    ],
  },

  MACHINE: {
    alias: 'M',
    columns: [
      'MACHINE_ID',
      'MACHINE_CODE',
      'MACHINE_TYPE',
      'LINE_ID',
      'LOCATION',
    ],
  },

  WORK_ORDER: {
    alias: 'WO',
    columns: [
      'WORK_ORDER_ID',
      'WORK_ORDER_CODE',
      'PRODUCT_ID',
      'PLANNED_QTY',
      'STARTED_AT',
      'COMPLETED_AT',
      'ORDER_STATUS',
    ],
  },

  BOARD_UNIT: {
    alias: 'BU',
    columns: [
      'BOARD_ID',
      'SERIAL_NUMBER',
      'WORK_ORDER_ID',
      'PRODUCT_ID',
      'REVISION',
      'CREATED_AT',
      'CURRENT_STATUS',
    ],
  },

  PROCESS_EVENT: {
    alias: 'PE',
    columns: [
      'EVENT_ID',
      'BOARD_ID',
      'STAGE_ID',
      'MACHINE_ID',
      'EVENT_TIME',
      'OPERATOR_ID',
      'LOT_CODE',
      'TEMPERATURE_C',
      'PROCESS_DURATION_SEC',
      'PARAMETER_JSON',
      'EVENT_STATUS',
    ],
  },

  INSPECTION_RESULT: {
    alias: 'IR',
    columns: [
      'INSPECTION_ID',
      'BOARD_ID',
      'STAGE_ID',
      'MACHINE_ID',
      'INSPECTION_TIME',
      'INSPECTION_TYPE',
      'INSPECTION_STATUS',
      'MEASURED_VALUE',
      'MEASUREMENT_UNIT',
      'LOWER_LIMIT',
      'UPPER_LIMIT',
      'TEST_CODE',
      'TEST_DETAILS',
    ],
  },

  DEFECT_EVENT: {
    alias: 'DE',
    columns: [
      'DEFECT_EVENT_ID',
      'BOARD_ID',
      'INSPECTION_ID',
      'DEFECT_ID',
      'DETECTED_STAGE_ID',
      'SUSPECTED_ORIGIN_STAGE_ID',
      'CONFIRMED_ORIGIN_STAGE_ID',
      'DETECTED_AT',
      'DEFECT_COUNT',
      'SEVERITY',
      'ROOT_CAUSE_STATUS',
      'ROOT_CAUSE_NOTES',
      'DISPOSITION',
    ],
  },

  REWORK_EVENT: {
    alias: 'RE',
    columns: [
      'REWORK_ID',
      'BOARD_ID',
      'DEFECT_EVENT_ID',
      'REWORK_STAGE_ID',
      'REWORK_TIME',
      'ACTION_TAKEN',
      'REWORK_COST',
      'RETEST_RESULT',
      'CLOSED_AT',
    ],
  },
};

// --------------------------------------------------
// Explicit relationships
//
// Each relationship is defined by the real foreign-key
// columns from the uploaded KERVYN table definitions.
// --------------------------------------------------

const JOINS = [
  ['PRODUCT', 'WORK_ORDER', 'PRODUCT_ID', 'PRODUCT_ID'],
  ['PRODUCT', 'BOARD_UNIT', 'PRODUCT_ID', 'PRODUCT_ID'],

  ['WORK_ORDER', 'BOARD_UNIT', 'WORK_ORDER_ID', 'WORK_ORDER_ID'],

  ['BOARD_UNIT', 'PROCESS_EVENT', 'BOARD_ID', 'BOARD_ID'],
  ['BOARD_UNIT', 'INSPECTION_RESULT', 'BOARD_ID', 'BOARD_ID'],
  ['BOARD_UNIT', 'DEFECT_EVENT', 'BOARD_ID', 'BOARD_ID'],
  ['BOARD_UNIT', 'REWORK_EVENT', 'BOARD_ID', 'BOARD_ID'],

  ['PROCESS_STAGE', 'PROCESS_EVENT', 'STAGE_ID', 'STAGE_ID'],
  ['PROCESS_STAGE', 'INSPECTION_RESULT', 'STAGE_ID', 'STAGE_ID'],
  ['PROCESS_STAGE', 'DEFECT_EVENT', 'STAGE_ID', 'DETECTED_STAGE_ID'],
  ['PROCESS_STAGE', 'REWORK_EVENT', 'STAGE_ID', 'REWORK_STAGE_ID'],

  ['MACHINE', 'PROCESS_EVENT', 'MACHINE_ID', 'MACHINE_ID'],
  ['MACHINE', 'INSPECTION_RESULT', 'MACHINE_ID', 'MACHINE_ID'],

  ['DEFECT_TYPE', 'DEFECT_EVENT', 'DEFECT_ID', 'DEFECT_ID'],

  ['INSPECTION_RESULT', 'DEFECT_EVENT', 'INSPECTION_ID', 'INSPECTION_ID'],

  ['DEFECT_EVENT', 'REWORK_EVENT', 'DEFECT_EVENT_ID', 'DEFECT_EVENT_ID'],
];

const AGGREGATES = new Set([
  'none',
  'count',
  'count_distinct',
  'sum',
  'avg',
  'min',
  'max',
]);

const OPERATORS = new Set([
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'contains',
  'starts_with',
  'ends_with',
  'in',
  'not_in',
  'is_null',
  'is_not_null',
]);

// --------------------------------------------------
// SQL helpers
// --------------------------------------------------

function normalizeName(value) {
  return String(value || '').trim().toUpperCase();
}

function quoteIdentifier(value) {
  const name = normalizeName(value);

  if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) {
    throw new Error('Invalid SQL identifier.');
  }

  return `"${name}"`;
}

function quoteValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Invalid numeric filter value.');
    }

    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (typeof value !== 'string') {
    throw new Error('Unsupported SQL filter value.');
  }

  if (value.length > 1000) {
    throw new Error('Filter value is too long.');
  }

  return `'${value.replaceAll("'", "''")}'`;
}

function safeRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.slice(0, MAX_ROWS).map((row) => {
    if (!row || typeof row !== 'object') {
      return { VALUE: row };
    }

    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date
          ? value.toISOString()
          : typeof value === 'bigint'
            ? value.toString()
            : value,
      ]),
    );
  });
}

// --------------------------------------------------
// Query-plan field validation
// --------------------------------------------------

function validateField(field, allowedTables) {
  if (!field || typeof field !== 'object') {
    throw new Error('Invalid field in query plan.');
  }

  const table = normalizeName(field.table);
  const column = normalizeName(field.column);

  if (!allowedTables.has(table)) {
    throw new Error(`Table ${table} was not selected.`);
  }

  if (!TABLES[table]?.columns.includes(column)) {
    throw new Error(`Unknown column ${table}.${column}.`);
  }

  return { table, column };
}


// --------------------------------------------------
// Explicit join-path resolver
// --------------------------------------------------

function findJoinPath(startTable, targetTable, joinedTables) {
  if (joinedTables.has(targetTable)) {
    return [];
  }

  const queue = [{
    table: startTable,
    path: [],
    visited: new Set([startTable]),
  }];

  while (queue.length) {
    const current = queue.shift();

    for (const [left, right, leftKey, rightKey] of JOINS) {
      let nextTable;
      let fromTable;
      let fromKey;
      let toKey;

      if (current.table === left) {
        nextTable = right;
        fromTable = left;
        fromKey = leftKey;
        toKey = rightKey;
      } else if (current.table === right) {
        nextTable = left;
        fromTable = right;
        fromKey = rightKey;
        toKey = leftKey;
      } else {
        continue;
      }

      if (current.visited.has(nextTable)) continue;

      const step = {
        fromTable,
        toTable: nextTable,
        fromKey,
        toKey,
      };

      const path = [...current.path, step];

      if (nextTable === targetTable) {
        return path;
      }

      const visited = new Set(current.visited);
      visited.add(nextTable);

      queue.push({
        table: nextTable,
        path,
        visited,
      });
    }
  }

  return null;
}

function compileJoins(baseTable, requestedTables) {
  const joined = new Set([baseTable]);
  const joins = [];

  for (const target of requestedTables) {
    if (joined.has(target)) continue;

    let bestPath = null;

    for (const existing of joined) {
      const path = findJoinPath(
        existing,
        target,
        joined,
      );

      if (
        path &&
        (!bestPath || path.length < bestPath.length)
      ) {
        bestPath = path;
      }
    }

    if (!bestPath) {
      throw new Error(
        `No approved relationship connects ${target} to the selected tables.`,
      );
    }

    for (const step of bestPath) {
      if (joined.has(step.toTable)) continue;

      const fromAlias = TABLES[step.fromTable].alias;
      const toAlias = TABLES[step.toTable].alias;

      joins.push(`
        LEFT JOIN ${SCHEMA}.${step.toTable} ${toAlias}
          ON ${fromAlias}.${quoteIdentifier(step.fromKey)}
           = ${toAlias}.${quoteIdentifier(step.toKey)}
      `);

      joined.add(step.toTable);
    }
  }

  return {
    joins: joins.join('\n'),
    joined,
  };
}

// --------------------------------------------------
// Query-plan compiler
// --------------------------------------------------

function compileSelectField(field, allowedTables) {
  const table = normalizeName(field.table);
  const column = normalizeName(field.column);
  const aggregate = String(
    field.aggregate || 'none',
  ).toLowerCase();

  if (!allowedTables.has(table)) {
    throw new Error(`Table ${table} was not selected.`);
  }

  if (!AGGREGATES.has(aggregate)) {
    throw new Error(`Unsupported aggregate: ${aggregate}`);
  }

  let expression;

  if (column === '*' && aggregate === 'count') {
    expression = 'COUNT(*)';
  } else {
    const base = fieldExpression(
      { table, column },
      allowedTables,
    );

    switch (aggregate) {
      case 'count':
        expression = `COUNT(${base})`;
        break;
      case 'count_distinct':
        expression = `COUNT(DISTINCT ${base})`;
        break;
      case 'sum':
        expression = `SUM(${base})`;
        break;
      case 'avg':
        expression = `AVG(${base})`;
        break;
      case 'min':
        expression = `MIN(${base})`;
        break;
      case 'max':
        expression = `MAX(${base})`;
        break;
            default:
        expression = base;
    }
  }

  const alias = field.alias
    ? normalizeName(field.alias)
    : aggregate === 'none'
      ? column
      : aggregate.toUpperCase();

  return `${expression} AS ${quoteIdentifier(alias)}`;
}

function resolveFieldReference(field, allowedTables) {
  if (!field || typeof field !== 'object') {
    throw new Error('Invalid field reference.');
  }

  const column = normalizeName(field.column);
  let table = normalizeName(field.table);

  if (!column) {
    throw new Error('A field reference is missing its column.');
  }

  if (!table) {
    const matches = [...allowedTables].filter((name) =>
      TABLES[name]?.columns.includes(column)
    );

    if (matches.length === 0) {
      throw new Error(
        `Cannot resolve column "${column}" in the selected tables.`
      );
    }

    if (matches.length > 1) {
      throw new Error(
        `Column "${column}" is ambiguous. Sarvam must specify its table.`
      );
    }

    table = matches[0];
  }

  if (!allowedTables.has(table)) {
    throw new Error(`Table "${table}" was not selected.`);
  }

  if (column !== '*' && !TABLES[table].columns.includes(column)) {
    throw new Error(`Unknown column ${table}.${column}.`);
  }

  return { table, column };
}

function fieldExpression(field, allowedTables) {
  const { table, column } = resolveFieldReference(
    field,
    allowedTables
  );

  if (column === '*') {
    throw new Error('Wildcard is only supported with COUNT(*).');
  }

  return `${TABLES[table].alias}.${quoteIdentifier(column)}`;
}


// Exasol TIMESTAMP columns in the KERVYN schema.
// Exasol TIMESTAMP has no timezone; timezone-aware inputs are normalized to UTC.
const TIMESTAMP_COLUMNS = new Set([
  'PRODUCT.CREATED_AT',
  'WORK_ORDER.STARTED_AT',
  'WORK_ORDER.COMPLETED_AT',
  'BOARD_UNIT.CREATED_AT',
  'PROCESS_EVENT.EVENT_TIME',
  'INSPECTION_RESULT.INSPECTION_TIME',
  'DEFECT_EVENT.DETECTED_AT',
  'REWORK_EVENT.REWORK_TIME',
  'REWORK_EVENT.CLOSED_AT',
]);

function formatExasolTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Timestamp filter must be a non-empty string.');
  }

  const input = value.trim();
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(input);

  let normalized;
  if (hasTimezone) {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid timestamp: ${input}`);
    }
    normalized = date.toISOString().replace('T', ' ').replace('Z', '');
  } else {
    const match = input.match(
      /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?)?$/
    );
    if (!match) {
      throw new Error(
        'Timestamp must use YYYY-MM-DD HH:mm:ss or an ISO-8601 timestamp with timezone.'
      );
    }
    normalized = `${match[1]} ${match[2] || '00:00:00'}.${(match[3] || '').padEnd(6, '0')}`;
  }

  const [datePart, timePart] = normalized.split(' ');
  const [wholeSeconds, fraction = ''] = timePart.split('.');
  return `TIMESTAMP '${datePart} ${wholeSeconds}.${fraction.padEnd(6, '0').slice(0, 6)}'`;
}

function quoteFilterValue(value, fieldReference) {
  if (
    TIMESTAMP_COLUMNS.has(`${fieldReference.table}.${fieldReference.column}`)
  ) {
    return formatExasolTimestamp(value);
  }
  return quoteValue(value);
}

function inferFilterTable(filter) {
  if (normalizeName(filter.table)) return filter;

  const column = normalizeName(filter.column);
  const matches = Object.keys(TABLES).filter((table) =>
    TABLES[table].columns.includes(column)
  );

  if (matches.length === 0) {
    throw new Error(`Cannot resolve filter column "${column}".`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Filter column "${column}" is ambiguous. Sarvam must specify its table.`
    );
  }

  return { ...filter, table: matches[0] };
}

function getColumnComparisonReference(filter) {
  if (filter.valueType === 'column' && filter.value && typeof filter.value === 'object') {
    return filter.value;
  }
  if (filter.value && typeof filter.value === 'object' && !Array.isArray(filter.value)
      && filter.value.column) {
    return filter.value;
  }
  return null;
}

function compileFilter(filter, allowedTables) {
  const resolved = resolveFieldReference(filter, allowedTables);
  const expression = fieldExpression(resolved, allowedTables);
  const operator = String(filter.operator || '=').toLowerCase();

  if (!OPERATORS.has(operator)) {
    throw new Error(`Unsupported filter operator: ${operator}`);
  }

  if (operator === 'is_null') return `${expression} IS NULL`;
  if (operator === 'is_not_null') return `${expression} IS NOT NULL`;

  const columnComparison = getColumnComparisonReference(filter);
  if (columnComparison) {
    if (!['=', '!=', '>', '>=', '<', '<='].includes(operator)) {
      throw new Error('Column-to-column comparisons only support comparison operators.');
    }
    const right = resolveFieldReference(columnComparison, allowedTables);
    const rightExpression = fieldExpression(right, allowedTables);
    return `${expression} ${{'!=': '<>'}[operator] || operator} ${rightExpression}`;
  }

  if (operator === 'in' || operator === 'not_in') {
    if (
      !Array.isArray(filter.value) ||
      filter.value.length === 0 ||
      filter.value.length > 20
    ) {
      throw new Error('Invalid IN filter.');
    }

    const values = filter.value
      .map((value) => quoteFilterValue(value, resolved))
      .join(', ');

    return `${expression} ${operator === 'in' ? 'IN' : 'NOT IN'} (${values})`;
  }

  if (operator === 'contains') {
    return `${expression} LIKE ${quoteValue(`%${String(filter.value)}%`)}`;
  }
  if (operator === 'starts_with') {
    return `${expression} LIKE ${quoteValue(`${String(filter.value)}%`)}`;
  }
  if (operator === 'ends_with') {
    return `${expression} LIKE ${quoteValue(`%${String(filter.value)}`)}`;
  }

  const sqlOperator = {
    '=': '=',
    '!=': '<>',
    '>': '>',
    '>=': '>=',
    '<': '<',
    '<=': '<=',
  }[operator];

  return `${expression} ${sqlOperator} ${quoteFilterValue(filter.value, resolved)}`;
}

function compileQueryPlan(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('Invalid AI query plan.');
  }
  if (!Array.isArray(plan.tables) || !plan.tables.length) {
    throw new Error('Query plan has no tables.');
  }
  if (!Array.isArray(plan.fields) || !plan.fields.length || plan.fields.length > 12) {
    throw new Error('Invalid SELECT field count.');
  }

  const requestedTables = [...new Set(plan.tables.map(normalizeName))];
  if (requestedTables.length > 5) {
    throw new Error('The query requests too many primary tables.');
  }
  for (const table of requestedTables) {
    if (!TABLES[table]) throw new Error(`Table ${table} is not permitted.`);
  }

  const filters = Array.isArray(plan.filters) ? plan.filters.map(inferFilterTable) : [];
  if (filters.length > 12) throw new Error('Too many query filters.');

  const orderBy = Array.isArray(plan.orderBy) ? plan.orderBy : [];
    if (orderBy.length > 4) throw new Error('Too many ORDER BY fields.');

  // Add tables referenced by fields, filters, column comparisons and ordering.
  // This prevents Sarvam from silently omitting a referenced table.
  const requiredTables = new Set(requestedTables);
  for (const field of plan.fields) {
    const table = normalizeName(field?.table);
    const column = normalizeName(field?.column);
    if (!TABLES[table]) throw new Error(`Selected field references unknown table "${table}".`);
    if (column !== '*' && !TABLES[table].columns.includes(column)) {
      throw new Error(`Unknown column ${table}.${column}.`);
    }
    requiredTables.add(table);
  }

  for (const filter of filters) {
    const table = normalizeName(filter.table);
    const column = normalizeName(filter.column);
    if (!TABLES[table] || !TABLES[table].columns.includes(column)) {
      throw new Error(`Unknown filter column ${table}.${column}.`);
    }
    requiredTables.add(table);

    const right = getColumnComparisonReference(filter);
    if (right) {
      const rightTable = normalizeName(right.table);
      const rightColumn = normalizeName(right.column);
      if (!TABLES[rightTable] || !TABLES[rightTable].columns.includes(rightColumn)) {
        throw new Error(`Unknown comparison column ${rightTable}.${rightColumn}.`);
      }
      requiredTables.add(rightTable);
    }
  }

  for (const item of orderBy) {
    const alias = normalizeName(item?.alias || item?.column);
    const table = normalizeName(item?.table);
    const column = normalizeName(item?.column);

    // ORDER BY may refer to a selected output alias.
    const selectedByAlias = plan.fields.some((field) => {
      const fieldAlias = normalizeName(
        field?.alias ||
        (
          String(field?.aggregate || 'none').toLowerCase() === 'none'
            ? field?.column
            : `${String(field?.aggregate).toLowerCase()}_${field?.column === '*' ? 'ALL' : field?.column}`
        )
      );

      return fieldAlias === alias;
    });

    if (selectedByAlias) {
      continue;
    }

    // Otherwise, require a valid physical table and column.
    if (!TABLES[table] || !TABLES[table].columns.includes(column)) {
      throw new Error(`Unknown ORDER BY field ${table}.${column}.`);
    }

    requiredTables.add(table);
  }

  if (requiredTables.size > 8) {
    throw new Error('The query requires too many tables, including join bridges.');
  }

  const baseTable = normalizeName(plan.baseTable || requestedTables[0]);
  if (!requiredTables.has(baseTable)) {
    throw new Error('Invalid base table.');
  }

  const joinResult = compileJoins(baseTable, [...requiredTables]);

  // compileJoins may insert approved intermediate bridge tables. Compare
  // required tables by membership, not by set size.
  for (const table of requiredTables) {
    if (!joinResult.joined.has(table)) {
      throw new Error(`Not all required tables could be joined. Missing ${table}.`);
    }
  }

  // Include bridge tables in the allowed set so validated field resolution
  // works for any fields that legitimately reference a bridge.
  const allowedTables = joinResult.joined;

  const fields = plan.fields.map((field) => {
    const table = normalizeName(field.table);
    const column = normalizeName(field.column);
    const aggregate = String(field.aggregate || 'none').toLowerCase();

    if (!allowedTables.has(table)) {
      throw new Error(`Selected field references unjoined table "${table}".`);
    }
    if (!AGGREGATES.has(aggregate)) {
      throw new Error(`Unsupported aggregate: ${aggregate}`);
    }
    if (column === '*') {
      if (aggregate !== 'count') {
        throw new Error('Wildcard is only supported with COUNT(*).');
      }
    } else if (!TABLES[table].columns.includes(column)) {
      throw new Error(`Unknown column ${table}.${column}.`);
    }

    const alias = field.alias
      ? normalizeName(field.alias)
      : aggregate === 'none'
        ? column
        : `${aggregate}_${column === '*' ? 'ALL' : column}`;

    if (!/^[A-Z_][A-Z0-9_]*$/.test(alias)) {
      throw new Error(`Invalid output alias "${alias}".`);
    }

    return { table, column, aggregate, alias };
  });

  const aliases = fields.map((field) => field.alias);
  if (new Set(aliases).size !== aliases.length) {
    throw new Error('Duplicate SELECT aliases are not permitted.');
  }

  const hasAggregate = fields.some((field) => field.aggregate !== 'none');
  const selectSql = fields.map((field) => {
    let expression;
    if (field.column === '*' && field.aggregate === 'count') {
      expression = 'COUNT(*)';
    } else {
      const base = fieldExpression(field, allowedTables);
      switch (field.aggregate) {
        case 'count': expression = `COUNT(${base})`; break;
        case 'count_distinct': expression = `COUNT(DISTINCT ${base})`; break;
        case 'sum': expression = `SUM(${base})`; break;
        case 'avg': expression = `AVG(${base})`; break;
        case 'min': expression = `MIN(${base})`; break;
        case 'max': expression = `MAX(${base})`; break;
        default: expression = base;
      }
    }
    return `${expression} AS ${quoteIdentifier(field.alias)}`;
  }).join(',\n      ');

  const groupFields = hasAggregate
    ? fields.filter((field) => field.aggregate === 'none')
    : [];
  const groupSql = groupFields.length
    ? groupFields.map((field) => fieldExpression(field, allowedTables)).join(', ')
    : '';

  const whereSql = filters.length
    ? filters.map((filter) => compileFilter(filter, allowedTables)).join('\n AND ')
    : '';

  // Keep ORDER BY restricted to selected output fields, using their aliases.
  const orderSql = orderBy.map((item) => {
  const requestedAlias = normalizeName(item.alias || item.column);
  const table = normalizeName(item.table);
  const column = normalizeName(item.column);

  const selectedField = fields.find(
    (field) =>
      field.alias === requestedAlias ||
      (
        field.table === table &&
        field.column === column
      )
  );

  if (!selectedField) {
    throw new Error(
      `ORDER BY field ${requestedAlias} must be included in SELECT.`
    );
  }

  const direction = String(item.direction || 'ASC').toUpperCase();

  if (!['ASC', 'DESC'].includes(direction)) {
    throw new Error('Invalid ORDER BY direction.');
  }

  return `${quoteIdentifier(selectedField.alias)} ${direction}`;
}).join(', ');

  const requestedLimit = Number.parseInt(plan.limit, 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(200, Math.max(1, requestedLimit))
    : MAX_ROWS;

  let sql = `
    SELECT
      ${selectSql}
    FROM ${SCHEMA}.${baseTable} ${TABLES[baseTable].alias}
    ${joinResult.joins}
  `;
  if (whereSql) sql += `\nWHERE ${whereSql}`;
  if (groupSql) sql += `\nGROUP BY ${groupSql}`;
  if (orderSql) sql += `\nORDER BY ${orderSql}`;
  sql += `\nLIMIT ${limit}`;

  return {
    sql,
    tables: [...allowedTables],
    limit,
  };
}

// --------------------------------------------------
// Sarvam API
// --------------------------------------------------

async function requestSarvam(messages, signal, maxTokens = 2000) {
  if (!SARVAM_API_KEY) {
    throw new Error('SARVAM_API_KEY is not configured.');
  }

  const response = await fetch(SARVAM_API_URL, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': SARVAM_API_KEY,
    },

    signal,

    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.1,
      max_tokens: maxTokens,
      reasoning_effort: null,
    }),
  });

  if (!response.ok) {
    const details = await response.text();

    console.error(
      '[SARVAM API ERROR]',
      response.status,
      details.slice(0, 1000),
    );

    throw new Error(
      `Sarvam returned HTTP ${response.status}.`,
    );
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Sarvam returned empty content.');
  }

  return content.trim();
}

function parseAIJson(content) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end <= start) {
    throw new Error('Sarvam did not return valid JSON.');
  }
    return JSON.parse(cleaned.slice(start, end + 1));
}

// --------------------------------------------------
// AI query planner
// --------------------------------------------------

function buildSchemaDescription() {
  return Object.entries(TABLES)
    .map(([table, definition]) => {
      return `${table}(${definition.columns.join(', ')})`;
    })
    .join('\n');
}

const JOIN_DESCRIPTION = `
Approved relationships:

PRODUCT.PRODUCT_ID = WORK_ORDER.PRODUCT_ID
PRODUCT.PRODUCT_ID = BOARD_UNIT.PRODUCT_ID
WORK_ORDER.WORK_ORDER_ID = BOARD_UNIT.WORK_ORDER_ID

BOARD_UNIT.BOARD_ID = PROCESS_EVENT.BOARD_ID
BOARD_UNIT.BOARD_ID = INSPECTION_RESULT.BOARD_ID
BOARD_UNIT.BOARD_ID = DEFECT_EVENT.BOARD_ID
BOARD_UNIT.BOARD_ID = REWORK_EVENT.BOARD_ID

PROCESS_STAGE.STAGE_ID = PROCESS_EVENT.STAGE_ID
PROCESS_STAGE.STAGE_ID = INSPECTION_RESULT.STAGE_ID
PROCESS_STAGE.STAGE_ID = DEFECT_EVENT.DETECTED_STAGE_ID
PROCESS_STAGE.STAGE_ID = REWORK_EVENT.REWORK_STAGE_ID

MACHINE.MACHINE_ID = PROCESS_EVENT.MACHINE_ID
MACHINE.MACHINE_ID = INSPECTION_RESULT.MACHINE_ID

DEFECT_TYPE.DEFECT_ID = DEFECT_EVENT.DEFECT_ID
INSPECTION_RESULT.INSPECTION_ID = DEFECT_EVENT.INSPECTION_ID
DEFECT_EVENT.DEFECT_EVENT_ID = REWORK_EVENT.DEFECT_EVENT_ID
`;

async function generateQueryPlan(message, history, signal) {
  const prompt = `
You are the analytical SQL planner for Kervyn.

Kervyn is a PCBA manufacturing quality and production analytics platform.

DATABASE SCHEMA:
${SCHEMA}

TABLES AND COLUMNS:
${buildSchemaDescription()}

${JOIN_DESCRIPTION}

USER QUESTION:
${message}

RECENT CONVERSATION (REFERENCE ONLY):
${JSON.stringify(history.slice(-6))}

Create a structured query plan. Do NOT return SQL.

STRICT RULES:

1. The CURRENT USER QUESTION is always the primary instruction.
2. Use previous messages ONLY when the current question clearly refers to something previously discussed.
3. Examples of explicit follow-ups include: "What about SMT?", "Compare that with the previous result.", "Show those defects by stage.", and "What about the same period?".
4. A standalone question is always a NEW analytical request.
5. For a new request, never reuse previous tables, filters, date ranges, stages, products, machines, defect types, metrics, or visualization requirements.
6. Never reuse a previous SQL query plan or previous database results.
7. Always generate a completely fresh query plan for the current question.
8. If the current question does not specify a time range, do not inherit the previous question's time range.
9. If the current question does not specify a product, stage, machine, or defect type, do not inherit one from previous messages.
10. For explicit follow-ups, retain only relevant context needed to interpret the current question. Update only the dimensions explicitly changed by the user.
11. Generate a structured query plan exclusively for the CURRENT USER QUESTION.
12. Do not generate raw SQL, execute queries, retrieve database results, or answer the analytical question directly.
13. Do not explain the query plan. Return ONLY the structured query plan in the required JSON format.
14. Only use the exact tables and columns provided in the approved database schema.
15. Only use explicitly approved relationships. Never invent tables, columns, relationships, or joins.
16. Use no more than 5 tables in a query plan.
17. Every table referenced in fields, filters, orderBy, or a column comparison must be included in tables. The server may automatically add approved bridge tables when necessary.
18. Do not join independent event tables unnecessarily or combine unrelated event tables in the same aggregate query.
19. Every selected field must explicitly specify its table and column.
20. Every filter must explicitly specify its table and column. Never omit the table property from filters.
21. Use no more than 12 selected fields, 12 filters, 8 groupBy fields, 4 orderBy fields, and a result limit of 200.
22. Only use these aggregation types: none, count, count_distinct, sum, avg, min, max.
23. Only use these filter operators: =, !=, >, >=, <, <=, contains, starts_with, ends_with, in, not_in, is_null, is_not_null.
24. For COUNT(*), use table with column "*" and aggregate "count".
25. Do not use SELECT expressions, SQL functions, SQL fragments, subqueries, CTEs, or raw SQL in any query-plan field.
26. For aggregate queries, include all desired grouping dimensions in the fields array with aggregate "none".
27. Do not rely on groupBy to define aggregation dimensions. The server derives GROUP BY automatically from selected non-aggregated fields.
28. Every orderBy field must also appear in fields.
29. Never select timestamps or severity fields unless they are necessary for the requested analysis.
30. Every filter must specify table, column, operator, and value when applicable.
31. For column-to-column comparisons, use valueType "column" and set value to an object containing the referenced table and column. For example: valueType "column", value {"table":"INSPECTION_RESULT","column":"UPPER_LIMIT"}.
32. Never put a column reference inside a string literal.
33. For timestamp filters, always use ISO-8601 values with an explicit timezone, for example "2024-01-01T00:00:00Z".
34. For rate calculations, request both the numerator and denominator whenever possible. Do not request only a percentage when the underlying count metrics can also be retrieved.
35. For time-trend analysis, use actual timestamp columns available in the approved schema. Never invent timestamp columns or derive time dimensions using raw SQL.
36. Select timestamps only when they are required for the requested time-based analysis.
37. Do not assume a default date range. If the user does not specify one, leave the time range unrestricted.
38. Generate the smallest query plan capable of answering the current question accurately.
39. Include only relevant tables, fields, filters, and aggregations. Avoid unnecessary joins, duplicate fields, redundant filters, and unrelated metrics.
40. Prefer direct table access when relationships are not required.
41. Never compromise schema correctness to make a query appear answerable.
42. Set cannotAnswer to true if the required information does not exist in the approved schema, the required table or column is unavailable, no approved relationship connects the required tables, the calculation cannot be represented using supported operations, or the question cannot be answered accurately within the defined limits.
43. Do not fabricate fields, relationships, or query conditions to force an answer.
44. Return valid JSON conforming exactly to the application's expected query-plan schema. Do not include Markdown code fences, explanations, commentary, analytical answers, or additional text.
45. Ensure all table and column references are valid and all query limits and restrictions are satisfied before returning the plan.
46. For unanswerable questions, set cannotAnswer to true according to the application's expected JSON schema.
47.For column-to-column comparisons, the operator MUST be one of:
    =, !=, >, >=, <, <=.
    Never use contains, starts_with, ends_with, in, not_in,
    is_null, or is_not_null for column-to-column comparisons.
48.ORDER BY can use either a selected physical field or its SELECT alias.
    Prefer the exact SELECT alias in the orderBy item's "alias" property.
    Never invent a physical database column for an aggregate alias.
49. FINAL PRIORITY: Always prioritize the current user question, generate a fresh and minimal query plan, strictly follow the approved database schema, and never carry over unrelated context from previous analytical requests.

Return ONLY JSON in this format:

{
  "cannotAnswer": false,
  "reason": "",
  "baseTable": "INSPECTION_RESULT",
  "tables": ["INSPECTION_RESULT", "PROCESS_STAGE"],
  "fields": [
    {
      "table": "PROCESS_STAGE",
      "column": "STAGE_NAME",
      "aggregate": "none",
      "alias": "STAGE_NAME"
    },
    {
      "table": "INSPECTION_RESULT",
      "column": "INSPECTION_ID",
      "aggregate": "count",
      "alias": "INSPECTION_COUNT"
    }
  ],
  "filters": [],
  "groupBy": [
    {
      "table": "PROCESS_STAGE",
      "column": "STAGE_NAME"
    }
  ],
  "orderBy": [
    {
      "table": "INSPECTION_RESULT",
      "column": "INSPECTION_ID",
      "direction": "DESC"
    }
  ],
  "limit": 40
}
`;

  const content = await requestSarvam(
    [
      {
        role: 'system',
        content:
          'You are a database query planner. Return valid JSON only. Never return SQL.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    signal,
    2500,
  );

  const plan = parseAIJson(content);

  if (plan.cannotAnswer) {
    return {
      cannotAnswer: true,
      reason: String(
        plan.reason || 'The available schema does not support this question.',
      ),
    };
  }

  return plan;
}

// --------------------------------------------------
// Visual normalization
// Compatible with your existing AIBox visuals format
// --------------------------------------------------

function firstDefined(...values) {
  return values.find(
    (value) => value !== undefined && value !== null,
  );
}

function normalizeChartData(data) {
  if (!Array.isArray(data)) return [];

  return data.map((point) => ({
    label: String(
      firstDefined(point?.label, point?.name, point?.x, ''),
    ),
    value: Number(
      firstDefined(point?.value, point?.y, 0),
    ),
  })).filter((point) => (
    point.label &&
    Number.isFinite(point.value)
  ));
}

function normalizeTable(item) {
  const sourceRows = Array.isArray(item.rows)
    ? item.rows
    : [];

  let columns = Array.isArray(item.columns)
    ? item.columns.map(String)
    : [];

  if (!columns.length && sourceRows.length) {
    columns = Object.keys(sourceRows[0] || {});
  }

  if (!columns.length || !sourceRows.length) {
    return null;
  }

  const rows = sourceRows.map((row) => {
    if (Array.isArray(row)) {
      return columns.map((_, index) => row[index] ?? '—');
    }

    return columns.map((column) => {
      const key = Object.keys(row || {}).find(
        (candidate) =>
          candidate.toLowerCase() === column.toLowerCase(),
      );

      return key && row[key] !== null && row[key] !== undefined
        ? row[key]
        : '—';
    });
  });

  return {
    type: 'table',
    title: item.title || 'Analysis Table',
    description: item.description || '',
    columns,
    rows,
  };
}


function normalizeVisuals(visuals) {
  if (!Array.isArray(visuals)) return [];

  return visuals.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];

    const type = String(
      item.type || item.visualization || item.chartType || '',
    ).toLowerCase();

    if (['metric', 'metric_card', 'kpi', 'stat'].includes(type)) {
      return [{
        type: 'metric',
        title: item.title || item.label || `Metric ${index + 1}`,
        value: firstDefined(item.value, item.number, item.metric, '—'),
        unit: item.unit || '',
        change: item.change,
        changeLabel:
          item.changeLabel ||
          item.subtitle ||
          item.description ||
          '',
      }];
    }

    if (['table', 'data_table', 'tabular'].includes(type)) {
      const table = normalizeTable(item);
      return table ? [table] : [];
    }

    const chartType = String(
      item.chartType || type,
    ).toLowerCase();

    if (!['bar', 'line', 'pie', 'doughnut'].includes(chartType)) {
      return [];
    }

    const data = normalizeChartData(item.data);

    if (!data.length) return [];

    return [{
      type: 'chart',
      title: item.title || 'Analysis Chart',
      chartType: chartType === 'doughnut' ? 'pie' : chartType,
      data,
      description: item.description || '',
      xAxis: item.xAxis || item.xAxisLabel || '',
      yAxis: item.yAxis || item.yAxisLabel || '',
    }];
  });
}

// --------------------------------------------------
// Fallback visuals from actual Exasol result rows
// --------------------------------------------------

function buildFallbackVisuals(rows, message) {
  if (!rows.length) return [];

  const columns = Object.keys(rows[0]);

  if (columns.length === 1 && rows.length === 1) {
    return [{
      type: 'metric',
      title: columns[0].replaceAll('_', ' '),
      value: rows[0][columns[0]],
      unit: '',
      changeLabel: 'Retrieved from Exasol',
    }];
  }

  if (columns.length >= 2) {
    const numericColumn = columns.find((column) =>
      rows.some((row) =>
        row[column] !== null &&
        row[column] !== '' &&
        Number.isFinite(Number(row[column])),
      ),
    );

    const labelColumn = columns.find(
      (column) => column !== numericColumn,
    );

    if (numericColumn && labelColumn) {
      const data = rows.map((row, index) => ({
        label: String(row[labelColumn] ?? `Row ${index + 1}`),
        value: Number(row[numericColumn]),
      })).filter((point) => Number.isFinite(point.value));

      if (data.length) {
        const requestedType =
          /\b(pie|donut|doughnut)\b/i.test(message)
            ? 'pie'
            : /\b(line chart|line graph|trend chart)\b/i.test(message)
              ? 'line'
              : 'bar';

        return [{
          type: 'chart',
          title: 'Query Results',
          chartType: requestedType,
          data,
          description: 'Visualization generated from the live Exasol result.',
          xAxis: labelColumn,
          yAxis: numericColumn,
        }];
      }
    }
  }

  return [{
    type: 'table',
    title: 'Query Results',
    description: 'Live results returned by Exasol.',
    columns,
    rows: rows.slice(0, MAX_ROWS).map((row) =>
      columns.map((column) => row[column] ?? '—'),
    ),
  }];
}

// --------------------------------------------------
// Final analytical answer
// --------------------------------------------------

async function generateAnswer(
  message,
  rows,
  plan,
  history,
  signal,
) {
  const prompt = JSON.stringify({
    userQuestion: message,
    recentConversation: history.slice(-6),
    queryPlan: plan,
    databaseEvidence: rows,

    instructions: [
      'Answer as Kervyn AI, a PCBA manufacturing analytics assistant.',
      'Use only the current database evidence for Kervyn data.',
      'Do not invent values, trends, records, or root causes.',
      'Clearly distinguish observations from hypotheses.',
      'Do not claim causation from correlation.',
      'Explain denominators when reporting percentages.',
      'If the result is empty, say no matching records were found.',
      'Use a metric visual for a single useful KPI.',
      'Use bar charts for category comparisons.',
      'Use line charts for time trends.',
      'Use pie charts only for meaningful proportions.',
      'Use only values in the database evidence.',
      'Use table rows as objects keyed by the column names.',
      'Return an empty visuals array if no visual is justified.',
      'Do not include SQL in the user-facing response.',
      'The current userQuestion is the only question you must answer.',
      'Use recentConversation only to resolve explicit references in the current question.',
      'Never answer a previous question instead of the current question.',
      'Never reuse previous query results, metrics, filters, or conclusions.',
      'The current databaseEvidence is the only source of current Kervyn data.',
      'If the current question is independent, completely ignore previous conversation context.',
      'Do not mention previous questions unless the current question explicitly refers to them.',
      'Ensure every metric and conclusion corresponds to the current queryPlan and databaseEvidence.',
    ],
  });

  const content = await requestSarvam(
    [
      {
        role: 'system',
        content: `
You are Kervyn AI, an analytical copilot for PCBA manufacturing.

Return only valid JSON:
{
  "reply": "Analysis text",
  "visuals": []
}

Visual types:
metric:
{
  "type": "metric",
  "title": "Total defects",
  "value": 10,
  "unit": "defects",
  "description": "Explanation"
}

chart:
{
  "type": "chart",
  "title": "Defects by stage",
  "chartType": "bar",
  "data": [
    {"label": "SMT", "value": 10}
  ],
  "description": "Explanation",
  "xAxis": "Stage",
  "yAxis": "Defects"
}

table:
{
  "type": "table",
  "title": "Defect details",
  "columns": ["Defect", "Count"],
  "rows": [
    {"Defect": "Solder bridge", "Count": 10}
  ]
}

Never fabricate database values.
        `,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    signal,
    4000,
  );

  const parsed = parseAIJson(content);

  if (
    typeof parsed.reply !== 'string' ||
    !parsed.reply.trim()
  ) {
    throw new Error('Sarvam returned no analytical answer.');
  }

  return {
    reply: parsed.reply.slice(0, 12000),
    visuals: normalizeVisuals(parsed.visuals),
  };
}

// --------------------------------------------------
// Session helpers
// --------------------------------------------------

function getOrCreateSession(requestedId) {
    if (
    typeof requestedId === 'string' &&
    sessions.has(requestedId)
  ) {
    return {
      sessionId: requestedId,
      session: sessions.get(requestedId),
    };
  }

  if (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;

    if (oldest) sessions.delete(oldest);
  }

  const sessionId = randomUUID();

  const session = {
    history: [],
    createdAt: Date.now(),
    inFlight: false,
  };

  sessions.set(sessionId, session);

  return { sessionId, session };
}

// --------------------------------------------------
// Express router
// --------------------------------------------------

export function createAiChatRouter({ db }) {
  if (typeof db !== 'function') {
    throw new TypeError(
      'createAiChatRouter requires the existing db(sql) function.',
    );
  }

  const router = Router();

  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 15,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: 'Too many AI requests. Please wait and try again.',
    },
  });

  router.post('/chat', limiter, async (req, res) => {
    if (!SARVAM_API_KEY) {
      return res.status(503).json({
        error: 'AI service is not configured.',
      });
    }

    const message = req.body?.message;

    if (
      typeof message !== 'string' ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: 'Enter a message.',
      });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: 'Message exceeds the 8000-character limit.',
      });
    }

    const {
      sessionId,
      session,
    } = getOrCreateSession(req.body?.sessionId);

    // Prevent concurrent requests from changing the same conversation history.
if (session.inFlight) {
  return res.status(409).json({
    error: 'Another request is already being processed in this conversation. Please wait.',
  });
}

session.inFlight = true;

// Use a stable snapshot throughout this request.
const historySnapshot = session.history.slice(-MAX_HISTORY);

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    try {
      // 1. Generate a structured query plan.
      const plan = await generateQueryPlan(
        message.trim(),
        historySnapshot,
        controller.signal,
      );

      if (plan.cannotAnswer) {
        const reply =
          `I couldn't answer that from the available Kervyn data. ` +
          `${plan.reason}`;

        session.history.push(
          { role: 'user', text: message.slice(0, 2000) },
          { role: 'assistant', text: reply.slice(0, 2000) },
        );

        session.history = session.history.slice(-MAX_HISTORY);

        return res.json({
          reply,
          visuals: [],
          sessionId,
          evidenceSources: [],
        });
      }

      // 2. Validate the query plan and compile SQL locally.
      const compiled = compileQueryPlan(plan);

      if (process.env.NODE_ENV === 'development') {
  console.log('\n[KERVYN AI GENERATED SQL]\n');
  console.log(compiled.sql);
  console.log('\n[KERVYN AI TABLES]', compiled.tables);
}

      // 3. Execute the compiled SELECT query against Exasol.
      // The existing db(sql) function returns result.getRows().
      const databaseRows = await db(compiled.sql);

      const rows = safeRows(databaseRows);

      const evidence = {
        description: 'Validated read-only query executed against KERVYN.',
        rowCount: rows.length,
        rows,
      };

      // 4. Generate a grounded analytical answer.
      const analysis = await generateAnswer(
        message.trim(),
        evidence,
        plan,
        historySnapshot,
        controller.signal,
      );

      let visuals = analysis.visuals;

      // 5. Fallback visualization if the model returned none.
      const explicitlyRequestsVisual =
        /\b(chart|graph|plot|visuali[sz]e|pie|doughnut|donut|table|tabular)\b/i
          .test(message);

      if (explicitlyRequestsVisual && !visuals.length) {
        visuals = buildFallbackVisuals(rows, message);
      }

      session.history.push(
        {
          role: 'user',
          text: message.slice(0, 2000),
        },
        {
          role: 'assistant',
          text: analysis.reply.slice(0, 2000),
        },
      );

      session.history = session.history.slice(-MAX_HISTORY);

      console.info('[KERVYN AI]', {
        tables: compiled.tables,
        returnedRows: rows.length,
        visuals: visuals.map((visual) => ({
          type: visual.type,
          title: visual.title,
          chartType: visual.chartType,
        })),
      });

      // Preserve the existing AIBox response contract.
      return res.json({
        reply: analysis.reply,
        visuals,
        sessionId,
        evidenceSources: compiled.tables,
      });
    } catch (error) {
      console.error('[KERVYN AI REQUEST FAILED]', error);

      if (error.name === 'AbortError') {
        return res.status(504).json({
          error: 'The analysis timed out. Try a narrower question.',
        });
      }

      return res.status(502).json({
        error:
          'Kervyn AI could not complete the analysis. Check the AI service and database connection.',
        ...(process.env.NODE_ENV === 'development'
          ? { details: error.message }
          : {}),
      });
    } finally {
      clearTimeout(timeout);
      session.inFlight = false;
    }
  });

  router.delete('/session/:sessionId', (req, res) => {
    sessions.delete(req.params.sessionId);

    return res.json({
      success: true,
      message: 'Session cleared.',
    });
  });

  return router;
}