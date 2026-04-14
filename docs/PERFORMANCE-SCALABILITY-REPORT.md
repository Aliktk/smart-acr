# Performance & Scalability Review Report

**Date:** 2026-04-10
**Reviewer:** Automated Performance Review (Claude)
**Project:** Smart ACR (Annual Confidential Report Management System)

---

## Executive Summary

The Smart ACR system is a mature enterprise application with NestJS backend, Next.js 15 frontend, PostgreSQL database, and Prisma ORM. The current architecture is optimized for correctness and security (role-based access control with organizational scoping), but has several performance bottlenecks that will impact scalability beyond ~5,000 ACR records or ~100 concurrent users.

**Key findings:** Unbounded queries, in-memory filtering after fetch, missing database indexes for common query patterns, no pagination on critical list endpoints, and frontend bundle optimization gaps.

---

## 1. Performance Risks

### 1.1 CRITICAL: Unbounded / Over-fetched Queries

| Endpoint | Issue | Impact |
|----------|-------|--------|
| `GET /dashboard/overview` | Fetches 1,000 ACRs with full nested includes (10+ org tables), then filters in memory | Response >2s at 5K records; DB pressure |
| `GET /acrs` (list) | `take: 500` then in-memory status filter | Returns unneeded rows; wastes bandwidth |
| `GET /archive/records` | `take: 500` then in-memory text search | Full scan of 500 records per request |
| `GET /notifications` | **No take limit** - loads ALL notifications | Unbounded growth; will crash at scale |
| `GET /analytics/dashboard` | Loads full ACR set with timeline + audit logs | Heaviest query in the system |

### 1.2 HIGH: In-Memory Post-Processing

The pattern of "fetch large set, then filter/aggregate in application code" appears in:

- **DashboardService.getOverview()** - Loads 1,000 records, calculates 12+ metrics via `.filter()` calls
- **ArchiveService.resolveVisibleRecords()** - Loads 500, searches across 12 text fields in-memory
- **AnalyticsService.dashboard()** - Full result set processed through 20+ aggregation functions
- **AcrService.list()** - Status filtering done in-memory after DB fetch

### 1.3 HIGH: N+1 Query Patterns

Heavy nested `include` patterns appear in every list endpoint:

```
AcrRecord
  -> Employee -> Wing, Directorate, Region, Zone, Circle, Station, Branch, Cell, Office, Department
  -> ReportingOfficer -> employeeProfiles
  -> CountersigningOfficer -> employeeProfiles
  -> Timeline (all entries)
  -> TemplateVersion
  -> ArchiveSnapshot
  -> ArchiveRecord
```

Each list endpoint includes **15+ related tables**. For a 500-record fetch, this generates massive JOIN operations.

### 1.4 MEDIUM: Employee Search (15-field OR query)

```typescript
OR: [
  { name: { contains: q, mode: "insensitive" } },
  { cnic: { contains: q } },
  { mobile: { contains: q } },
  // ... 15+ more fields including nested relations
  { office: { name: { contains: q, mode: "insensitive" } } },
  { wing: { name: { contains: q, mode: "insensitive" } } },
]
```

Each `contains` with `mode: "insensitive"` generates a `ILIKE '%query%'` which cannot use btree indexes. At 10K+ employees, this becomes a full table scan per search.

### 1.5 MEDIUM: Frontend Bundle Size

- `lucide-react` imports all icons (~200+), adding ~100KB+ to bundle
- `jspdf` + `html2canvas` (~500KB) loaded eagerly
- `playwright-core` in frontend dependencies (only used server-side for PDF)
- No code splitting for heavy components (1,200-line InteractiveForm)
- No image optimization configured in Next.js

### 1.6 LOW: Authorization Check on Every Row

`canAccessAcr()` runs per-row after fetch. For admin roles (SUPER_ADMIN, IT_OPS) this is wasted computation since they have full access. The pre-filter `buildAcrAccessPreFilter()` should handle this at the DB level.

---

## 2. Scalability Risks

### 2.1 Dashboard Aggregation Cost

The dashboard loads 1,000 ACRs per request to compute:
- 12 status metrics (filter operations)
- Fiscal year comparison (groupBy + delta calculation)
- Average completion time (reduce over completed set)
- Distribution chart (6 category counts)
- Retirement warnings (separate query)

**At 10K records:** Response time > 5s, memory > 100MB per request
**At 50K records:** OOM risk, timeout failures

### 2.2 Analytics as Data Grows

`AnalyticsService` is 1,575 lines of in-memory aggregation. At scale:
- Trend bucketing (day/week/month) iterates all records per bucket
- Performance heatmap calculates per-officer/per-wing metrics
- No caching layer; every dashboard refresh re-fetches everything

### 2.3 Archive History Growth

Historical uploads will grow linearly over years. The current `take: 500` becomes the effective page size, but there's no cursor or offset mechanism to access older records.

### 2.4 Audit Log Volume

Audit logs grow with every action. The paginated query is good, but `contains` filters on `action` and `displayName` are expensive at high volume. No archival or partitioning strategy.

### 2.5 File Storage (Disk-Based)

Files stored directly on disk via `STORAGE_PATH`. At scale:
- No CDN or object storage
- Single point of failure (no replication)
- File serve goes through NestJS (blocks event loop for large files)

### 2.6 Session Table Growth

Sessions are never pruned. The `Session` table grows indefinitely with:
- Every login creates a new session
- Revoked sessions remain in the table
- No TTL-based cleanup

---

## 3. Optimizations Implemented

### 3.1 Database Index Migration (`20260410_performance_indexes`)

Added 15 targeted indexes for common query patterns:

| Index | Benefit |
|-------|---------|
| `AcrRecord(workflowState, createdAt DESC)` | Dashboard + list queries |
| `AcrRecord(isPriority, createdAt DESC) WHERE isPriority` | Partial index for priority filter |
| `AcrRecord(completedDate) WHERE NOT NULL` | Completion time analytics |
| `AcrRecord(calendarYear, workflowState)` | Fiscal year analytics |
| `AcrRecord(hasAdverseRemarks) WHERE true` | Adverse remarks filter |
| `Employee(lower(name))` | Case-insensitive name search |
| `Employee(cnic)` | CNIC lookup |
| `Employee(status, retirementDate, reportingOfficerId)` | Retirement warnings |
| `ArchiveRecord(reportingPeriodTo DESC, createdAt DESC)` | Archive list sort |
| `ArchiveRecord(source, scopeTrack)` | Archive filter compound |
| `AuditLog(createdAt DESC)` | Audit pagination |
| `Notification(userId, createdAt DESC) WHERE readAt IS NULL` | Unread count |
| `Session(userId, expiresAt) WHERE revokedAt IS NULL` | Active session lookup |
| `AuthChallenge(expiresAt) WHERE consumedAt IS NULL` | Challenge cleanup |

### 3.2 Dashboard Query: Timeline Limit

**Before:** Full timeline loaded for all 1,000 ACRs (unbounded `timeline` include)
**After:** Timeline limited to 10 entries per ACR with `take: 10`

**Expected impact:** Reduces JOIN result set significantly for ACRs with long histories (30+ timeline entries each). At 1,000 ACRs with avg 15 timeline entries, this prevents loading ~15,000 timeline rows when only recent entries are needed for dashboard display.

### 3.3 ACR List: Push Status Filter to Database

**Before:** Fetch 500 records, then filter by status in JavaScript
**After:** Map status labels to `AcrWorkflowState` enums, add `workflowState: { in: [...] }` to WHERE clause

**Expected impact:** When filtering by status, DB returns only matching records instead of 500

### 3.4 ACR List: Reduce Take Limit

Reduced from `take: 500` to `take: 200` - more appropriate for a list view and reduces memory pressure.

### 3.5 Archive List: Database-Level Search

**Before:** Fetch 500, search 12 fields in-memory
**After:** Push text search to Prisma WHERE clause (`employeeName`, `employeeServiceNumber`, `employeePosting`, `archiveReference`), reduce take to 100, add parallel `count()` for total

**Expected impact:** 80% fewer rows fetched when searching; accurate total count

### 3.6 Notifications: Add Take Limit + Count

**Before:** No limit - loads ALL notifications
**After:** `take: 100` with parallel `count()` for total; selective include on `acrRecord`

### 3.7 Frontend: Next.js Config Optimization

- Enabled `compress: true` for gzip responses
- Added `image.formats: ["image/avif", "image/webp"]` for optimized images
- Added `experimental.optimizePackageImports: ["lucide-react"]` to tree-shake unused icons

---

## 4. Load-Testing Plan

### 4.1 Recommended Tool: k6 (Grafana)

k6 is ideal for this NestJS/PostgreSQL stack - JavaScript-based scripting, supports cookie auth, and integrates with Prometheus metrics already configured.

### 4.2 Test Scenarios

#### Scenario A: Concurrent Dashboard Load
```
VUs: 50 → 100 → 200 (ramp over 5 min)
Duration: 10 minutes
Endpoint: GET /api/v1/dashboard/overview
Target: p95 < 2s, error rate < 1%
```

#### Scenario B: ACR Queue (List + Filter)
```
VUs: 30 → 60 (ramp over 3 min)
Duration: 5 minutes
Endpoints:
  - GET /api/v1/acrs (no filters)
  - GET /api/v1/acrs?status=Draft
  - GET /api/v1/acrs?query=Ahmed
Target: p95 < 1s
```

#### Scenario C: Analytics Dashboard
```
VUs: 10 → 30 (ramp over 5 min)
Duration: 10 minutes
Endpoint: GET /api/v1/analytics/dashboard?datePreset=fy
Target: p95 < 5s (heavyweight query)
```

#### Scenario D: Employee Search
```
VUs: 20 → 50 (ramp over 3 min)
Duration: 5 minutes
Endpoint: GET /api/v1/employees/search?query=<random>
Target: p95 < 500ms
```

#### Scenario E: Mixed Workload
```
VUs: 100 (simultaneous)
Duration: 15 minutes
Mix: 40% dashboard, 25% ACR list, 15% search, 10% analytics, 10% notifications
Target: p95 < 3s across all endpoints
```

### 4.3 Data Seeding Requirements

- 10,000 ACR records across all workflow states
- 5,000 employees across 50+ offices
- 2,000 archive records
- 50,000 audit log entries
- 500 notifications per user

### 4.4 Monitoring During Tests

The existing Prometheus metrics middleware captures:
- Request count by route and status
- Response time histogram (5ms to 10s buckets)

Add these metrics during load tests:
- PostgreSQL connection pool usage (PgBouncer if available)
- Node.js heap memory and event loop lag
- Database query duration (Prisma query events)

---

## 5. Remaining Future Scaling Concerns

### 5.1 Short-Term (< 6 months)

| Concern | Recommendation | Priority |
|---------|---------------|----------|
| **Analytics query performance** | Create materialized views for dashboard aggregations; refresh on ACR state change | HIGH |
| **Employee search at scale** | Install `pg_trgm` extension and add GIN trigram indexes for `ILIKE` queries | HIGH |
| **Session cleanup** | Add scheduled job to delete sessions where `revokedAt IS NOT NULL` or `expiresAt < NOW() - interval '30 days'` | MEDIUM |
| **AuthChallenge cleanup** | Add scheduled job to delete expired/consumed challenges older than 24 hours | MEDIUM |
| **Frontend code splitting** | Dynamic import `jspdf`/`html2canvas`; split InteractiveForm into sub-components | MEDIUM |
| **Virtual scrolling** | Add `react-window` or `@tanstack/virtual` for queue/search tables with 100+ rows | MEDIUM |

### 5.2 Medium-Term (6-12 months)

| Concern | Recommendation | Priority |
|---------|---------------|----------|
| **Caching layer** | Add Redis for: org hierarchy (changes rarely), template catalog, user session data, dashboard metrics (30s TTL) | HIGH |
| **API pagination** | Implement cursor-based pagination for all list endpoints (ACRs, archive, notifications) | HIGH |
| **Audit log partitioning** | Partition `AuditLog` table by month using PostgreSQL table partitioning | MEDIUM |
| **File storage** | Migrate from disk to S3-compatible object storage; stream files instead of blocking | MEDIUM |
| **Read replicas** | Route analytics/dashboard queries to read replica to avoid write-path contention | MEDIUM |
| **PDF generation** | Pool Playwright browser instances instead of launching per-request; or switch to puppeteer-cluster | MEDIUM |

### 5.3 Long-Term (12+ months)

| Concern | Recommendation | Priority |
|---------|---------------|----------|
| **Archive scalability** | Consider time-based table partitioning for ArchiveRecord by fiscal year | MEDIUM |
| **Full-text search** | Migrate employee/archive search to PostgreSQL tsvector or Elasticsearch | HIGH at scale |
| **Event-driven architecture** | Emit domain events for ACR transitions; compute analytics asynchronously | MEDIUM |
| **Horizontal scaling** | The NestJS app is stateless (JWT auth, no in-memory sessions); can scale horizontally behind a load balancer | LOW (already possible) |
| **Database connection pooling** | Add PgBouncer between app and PostgreSQL for connection multiplexing at high concurrency | HIGH at 200+ VUs |

### 5.4 Caching Opportunities

| Data | TTL | Strategy |
|------|-----|----------|
| Organization hierarchy (Wings, Regions, Zones, etc.) | 1 hour | Cache on startup, invalidate on admin change |
| Template catalog (TemplateVersion) | 24 hours | Rarely changes |
| Dashboard overview per user+role | 30 seconds | Short TTL, stale-while-revalidate |
| User scope resolution (loadScopedUser) | 5 minutes | Called on every authenticated request |
| Employee search results | 60 seconds | Key by query + scope |

### 5.5 Query Optimization Opportunities

1. **Org scope resolution:** `loadScopedUser()` is called on every request. Cache result per session for 5 min.
2. **Dashboard metrics:** Use `groupBy` and `count` at DB level instead of fetching full records:
   ```sql
   SELECT "workflowState", COUNT(*) FROM "AcrRecord" WHERE ... GROUP BY "workflowState"
   ```
3. **Completion time:** Use DB aggregate instead of fetching all completed records:
   ```sql
   SELECT AVG(EXTRACT(DAY FROM "completedDate" - "createdAt")) FROM "AcrRecord" WHERE "completedDate" IS NOT NULL AND ...
   ```
4. **Fiscal year comparison:** Pre-compute fiscal year counts in a materialized view refreshed nightly.

### 5.6 Frontend Rendering Optimization

1. **Memoize table rows** with `React.memo()` in queue and search results
2. **Debounce filter inputs** (300ms) on audit logs, search, and queue pages
3. **Parallelize dashboard queries** - fetch session + overview simultaneously instead of sequentially
4. **Lazy load charts** - import chart components with `dynamic()` and show skeletons
5. **Add `loading="lazy"`** to all below-fold images in form templates

---

## Appendix: Index Coverage Analysis

### Existing Indexes (from schema)

```
User:           (isActive, updatedAt), (lastLoginAt), (scopeTrack, wingId, ..., officeId)
AcrRecord:      (employeeId), (employeeId, workflowState), (reportingOfficerId, workflowState),
                (countersigningOfficerId, workflowState), (workflowState), (workflowState, dueDate),
                (calendarYear), (secretBranchDeskCode, workflowState), (currentHolderId, workflowState)
Employee:       (officeId), (zoneId), (wingId), (status), (retirementDate),
                (scopeTrack, wingId, ..., officeId), (reportingOfficerId), (countersigningOfficerId)
ArchiveRecord:  (employeeId, source, createdAt), (templateFamily, isVerified, createdAt),
                (scopeTrack, wingId, ..., officeId)
Notification:   (userId, readAt, createdAt), (acrRecordId, createdAt)
Session:        (userId, revokedAt, expiresAt), (refreshTokenHash)
AuditLog:       (recordType, recordId, createdAt), (actorId, createdAt)
```

### New Indexes Added (this migration)

15 targeted indexes addressing gaps in:
- Sort order optimization (DESC indexes for time-series queries)
- Partial indexes for common filters (priority, adverse remarks, unread, active)
- Compound indexes for multi-column filter patterns
- Case-insensitive search prep indexes

---

*Report generated automatically as part of scheduled performance review.*
