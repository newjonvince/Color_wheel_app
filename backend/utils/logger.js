// logger.js — hardened, env-tunable, with redaction and child loggers
const LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

function parseLevel(env) {
  const v = String(env || '').toUpperCase();
  if (LEVELS[v] != null) return LEVELS[v];
  // default: prod=WARN, dev=DEBUG
  if (process.env.NODE_ENV === 'production') return LEVELS.WARN;
  return LEVELS.DEBUG;
}

const CURRENT = parseLevel(process.env.LOG_LEVEL);

// Redaction helpers
const SENSITIVE_HEADER_KEYS = new Set(['authorization', 'cookie', 'set-cookie']);
const SENSITIVE_FIELDS = new Set(['password', 'newPassword', 'token', 'accessToken', 'refreshToken']);

function redactHeaders(h = {}) {
  const out = { ...h };
  for (const k of Object.keys(out)) {
    if (SENSITIVE_HEADER_KEYS.has(k.toLowerCase())) out[k] = '***';
  }
  return out;
}
function redactBody(b) {
  if (!b || typeof b !== 'object') return b;
  const out = JSON.parse(JSON.stringify(b));
  for (const k of Object.keys(out)) {
    if (SENSITIVE_FIELDS.has(k)) out[k] = '***';
  }
  return out;
}

function ts() {
  return new Date().toISOString();
}

function logAt(levelName, min) {
  return (...args) => {
    if (CURRENT < min) return;
    const parts = [ `[${ts()}]`, `[${levelName}]`, ...args ];
    const fn = levelName === 'ERROR' ? console.error
      : levelName === 'WARN' ? console.warn
      : console.log;
    fn(...parts);
  };
}

const logger = {
  level: CURRENT,
  error: logAt('ERROR', LEVELS.ERROR),
  warn: logAt('WARN', LEVELS.WARN),
  info: logAt('INFO', LEVELS.INFO),
  debug: logAt('DEBUG', LEVELS.DEBUG),

  startup: (...args) => console.log(`[${ts()}]`, '[STARTUP]', ...args),

  // Rate-limited logs (prod→WARN, dev→INFO)
  rateLimited: (() => {
    const last = new Map();
    const RATE_LIMIT_MS = Number(process.env.LOG_RATE_LIMIT_MS || 5000);
    return (key, ...args) => {
      const now = Date.now();
      const prev = last.get(key) || 0;
      if (now - prev > RATE_LIMIT_MS) {
        last.set(key, now);
        if (process.env.NODE_ENV === 'production') {
          logger.warn(`[RATE:${key}]`, ...args);
        } else {
          logger.info(`[RATE:${key}]`, ...args);
        }
      }
    };
  })(),

  // Child logger with context prefix
  child(ctx = {}) {
    const prefix = Object.keys(ctx).length ? JSON.stringify(ctx) : '';
    const wrap = (fn) => (...args) => fn(prefix ? `${prefix}`, ...args);
    return {
      error: wrap(this.error),
      warn: wrap(this.warn),
      info: wrap(this.info),
      debug: wrap(this.debug),
      rateLimited: (key, ...args) => this.rateLimited(key, prefix, ...args),
    };
  },

  // Helpers to log redacted request metadata
  requestStarted(req) {
    const h = redactHeaders(req.headers || {});
    this.info('REQ', req.method, req.originalUrl || req.url, { ip: req.ip }, { headers: h });
  },
  requestBody(req) {
    if (req.is && req.is('application/json')) {
      this.debug('REQ_BODY', redactBody(req.body));
    } else {
      this.debug('REQ_BODY', '[non-JSON or multipart]');
    }
  },
};

module.exports = logger;
