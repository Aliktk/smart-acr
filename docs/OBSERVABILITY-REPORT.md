# Observability & Production Diagnostics Report

**Date:** 2026-04-10
**Scope:** smart-acr backend (NestJS) + frontend (Next.js)

---

## 1. Current Observability Gaps (Before This Session)

### Backend Gaps

| Area | Status Before | Impact |
|------|--------------|--------|
| Structured logging | NestJS default Logger only | Logs not parseable by aggregators |
| Correlation IDs | None | Cannot trace requests across logs |
| Request logging | No request lifecycle logging | No visibility into normal operations |
| Error logging (4xx) | Not logged | Client errors invisible |
| Error logging (5xx) | Only unhandled exceptions | Missing stack context |
| DB connection events | Silent | DB outages hard to diagnose |
| DB slow queries | Not detected | Performance degradation invisible |
| Health check detail | Basic OK/fail | No latency or memory data |
| Diagnostics endpoint | None | Ops has no deep inspection |
| Bootstrap logging | Silent | Startup failures not visible |
| Error response IDs | No requestId in responses | Users cannot report correlatable errors |
| Process-level events | None | No shutdown/startup lifecycle logging |

### Frontend Gaps

| Area | Status Before | Impact |
|------|--------------|--------|
| Global error boundary | Missing `global-error.tsx` | Root layout crashes show blank page |
| Error tracking service | None | Errors disappear on page refresh |
| API request logging | None | Blind to API communication issues |
| React Query retry | Per-mutation only | No global retry strategy |

---

## 2. Improvements Implemented

### 2.1 Structured JSON Logger (`logger.service.ts`)

**File:** `backend/src/common/logger.service.ts`

- Replaces NestJS default logger with `StructuredLogger`
- Outputs one JSON object per line to stdout/stderr
- Each log entry includes: `timestamp`, `level`, `message`, `context`, plus arbitrary structured fields
- `child()` method creates scoped loggers with inherited context
- Compatible with CloudWatch, Datadog, ELK, Grafana Loki, etc.
- Production mode suppresses debug/verbose levels

**Sample output:**
```json
{"timestamp":"2026-04-10T04:30:00.000Z","level":"info","message":"GET /api/v1/acr 200 12.3ms","context":"HTTP","requestId":"abc-123","module":"http"}
```

### 2.2 Request Context & Correlation IDs (`request-context.middleware.ts`)

**File:** `backend/src/common/request-context.middleware.ts`

- Uses `AsyncLocalStorage` for request-scoped context without DI
- Generates UUID correlation ID per request (or accepts `x-request-id` from upstream)
- Sets `x-request-id` response header for client correlation
- Stores: requestId, method, url, IP, user-agent, timing
- Any code can call `getRequestContext()` to access the current request's context

### 2.3 Request Logging Interceptor

**File:** `backend/src/common/interceptors/request-logging.interceptor.ts`

- Logs every completed HTTP request with method, path, status code, and duration
- Skips health/metrics endpoints to reduce noise
- Log level based on status: 5xx = error, 4xx = warn, 2xx/3xx = info
- Includes requestId for correlation

### 2.4 Enhanced Global Exception Filter

**File:** `backend/src/common/filters/http-exception.filter.ts`

- Now uses structured logger instead of NestJS Logger
- Includes `requestId` in all error logs and error responses
- Logs 4xx client errors as warnings (previously silent)
- Includes userId, method, path context in error logs
- Error responses now include `requestId` field for user bug reports

### 2.5 Enhanced PrismaService

**File:** `backend/src/common/prisma.service.ts`

- Logs database connection/disconnection lifecycle events
- Subscribes to Prisma `error` and `warn` events via structured logger
- In non-production: detects and warns about slow queries (>500ms)
- Connection failures logged with full error detail before re-throwing
- Implements `OnModuleDestroy` for clean shutdown logging

### 2.6 Enhanced Health Checks

**File:** `backend/src/modules/health/health.controller.ts`

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /api/v1/health` | Liveness probe (fast, no deps) | None |
| `GET /api/v1/health/ready` | Readiness probe (checks DB + storage) | None |
| `GET /api/v1/health/diagnostics` | Deep diagnostics | None (should add auth) |

New features:
- Per-check latency measurement
- Memory usage reporting (RSS, heap, external)
- Process uptime tracking
- Failed checks logged as errors
- Prometheus health gauges updated from readiness check

### 2.7 Bootstrap Improvements

**File:** `backend/src/main.ts`

- NestJS now uses `StructuredLogger` as its internal logger
- Startup message logged with port and environment
- Bootstrap failures caught, logged, and exit with code 1
- Global `RequestLoggingInterceptor` registered

### 2.8 Frontend Global Error Boundary

**File:** `frontend/src/app/global-error.tsx`

- Catches unhandled errors at the root layout level
- Stores errors in sessionStorage (same format as existing ErrorBoundary)
- Shows user-friendly error page with "Try Again" button
- Displays error digest ID when available

---

## 3. Health Check & Status Endpoints

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/v1/health` | GET | Liveness | `{ok, service, uptime, startedAt, timestamp}` |
| `/api/v1/health/ready` | GET | Readiness | `{ok, checks: {database, storage}, uptime, memory}` |
| `/api/v1/health/diagnostics` | GET | Deep diagnostics | `{ok, version, nodeVersion, env, uptime, memory, checks}` |
| `/api/v1/metrics` | GET | Prometheus metrics | Text format (auth required) |

### Docker Integration

The existing Dockerfile HEALTHCHECK (`/api/v1/health`) remains compatible. For Kubernetes:

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 15

readinessProbe:
  httpGet:
    path: /api/v1/health/ready
    port: 4000
  initialDelaySeconds: 15
  periodSeconds: 10
  failureThreshold: 3
```

---

## 4. Logging Improvements Summary

### Log Levels Usage

| Level | When Used |
|-------|-----------|
| `fatal` | Bootstrap failure, unrecoverable state |
| `error` | 5xx errors, unhandled exceptions, DB connection failure, health check failure |
| `warn` | 4xx client errors, slow DB queries (>500ms), DB warnings |
| `info` | 2xx/3xx requests, DB connected, server started, lifecycle events |
| `debug` | Development-only detail (suppressed in production) |

### Correlation Flow

```
Client Request
  -> x-request-id header (generated if absent)
  -> RequestContextMiddleware (AsyncLocalStorage)
  -> All middleware/interceptors/services can read requestId
  -> Error responses include requestId
  -> x-request-id response header returned
  -> Client can log/display requestId for support
```

---

## 5. Monitoring & Alert Recommendations

### Immediate (Prometheus + Existing Metrics)

| Metric | Alert Condition | Severity |
|--------|----------------|----------|
| `smart_acr_http_requests_total{status="500"}` | >5 in 5 minutes | Critical |
| `smart_acr_http_request_duration_seconds` p95 | >2s sustained | Warning |
| `smart_acr_health_check_status{check="database"}` | = 0 | Critical |
| `smart_acr_health_check_status{check="storage"}` | = 0 | Critical |
| Readiness endpoint | Fails 3 consecutive checks | Critical |
| Memory RSS | >512MB sustained | Warning |

### Log-Based Alerts

| Log Pattern | Alert Condition | Severity |
|-------------|----------------|----------|
| `"level":"error","context":"ExceptionFilter"` | >10 in 5 min | Critical |
| `"level":"error","context":"Prisma"` | Any occurrence | Critical |
| `"level":"warn","context":"Prisma"` (slow query) | >5 in 1 min | Warning |
| `"level":"fatal"` | Any occurrence | Critical |
| `"module":"exception","statusCode":429` | >50 in 1 min | Warning (possible abuse) |

### Recommended Next Steps

1. **Log aggregation:** Ship structured JSON logs to CloudWatch/Datadog/ELK
2. **Error tracking:** Integrate Sentry for both backend and frontend
3. **APM:** Consider Datadog APM or OpenTelemetry for distributed tracing
4. **Dashboard:** Build Grafana dashboard from Prometheus metrics endpoint
5. **Uptime monitoring:** External check on `/api/v1/health/ready` every 30s
6. **Frontend RUM:** Add Real User Monitoring for client-side performance

### Key Operational Signals

| Signal | Where to Find | What It Means |
|--------|---------------|---------------|
| DB connection lost | `"context":"Prisma","level":"error"` | Database unavailable |
| Slow queries | `"context":"Prisma","level":"warn"` | Performance degradation |
| Auth failures spike | `status=401` in metrics | Possible credential attack |
| Rate limiting | `status=429` in metrics | Client abuse or misconfiguration |
| Storage failure | Readiness check storage=unavailable | Disk full or mount issue |
| Memory growth | Diagnostics endpoint memory field | Possible memory leak |
| Request latency growth | Duration histogram p95 | Backend degradation |
| Bootstrap failure | `"level":"fatal","context":"Bootstrap"` | Deployment problem |

---

## Files Modified

| File | Change |
|------|--------|
| `backend/src/common/logger.service.ts` | **NEW** - Structured JSON logger |
| `backend/src/common/request-context.middleware.ts` | **NEW** - Correlation ID middleware |
| `backend/src/common/interceptors/request-logging.interceptor.ts` | **NEW** - Request lifecycle logging |
| `backend/src/common/filters/http-exception.filter.ts` | Enhanced with structured logging + requestId |
| `backend/src/common/prisma.service.ts` | Enhanced with connection/query logging |
| `backend/src/modules/health/health.controller.ts` | Enhanced with latency, memory, diagnostics |
| `backend/src/modules/health/health.module.ts` | Added RequestContextMiddleware |
| `backend/src/main.ts` | Structured logger, bootstrap error handling |
| `frontend/src/app/global-error.tsx` | **NEW** - Global error boundary |
