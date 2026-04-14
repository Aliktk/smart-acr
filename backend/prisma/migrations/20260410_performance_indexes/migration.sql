-- Performance & scalability indexes
-- Migration: 20260410_performance_indexes
-- Purpose: Add missing indexes identified during performance review

-- =============================================================================
-- AcrRecord: Composite indexes for common query patterns
-- =============================================================================

-- Dashboard/analytics queries filter by createdAt with state
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AcrRecord_workflowState_createdAt_idx"
  ON "AcrRecord" ("workflowState", "createdAt" DESC);

-- ACR list queries sort by createdAt descending with priority filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AcrRecord_isPriority_createdAt_idx"
  ON "AcrRecord" ("isPriority", "createdAt" DESC)
  WHERE "isPriority" = true;

-- Completion analysis: filter by completedDate for avg completion time
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AcrRecord_completedDate_idx"
  ON "AcrRecord" ("completedDate")
  WHERE "completedDate" IS NOT NULL;

-- Calendar year + state for fiscal year analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AcrRecord_calendarYear_workflowState_idx"
  ON "AcrRecord" ("calendarYear", "workflowState");

-- Adverse remarks filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AcrRecord_hasAdverseRemarks_idx"
  ON "AcrRecord" ("hasAdverseRemarks")
  WHERE "hasAdverseRemarks" = true;

-- =============================================================================
-- Employee: Search and scope optimization
-- =============================================================================

-- Trigram-like optimization for name search (case-insensitive contains)
-- PostgreSQL can use btree for prefix matching; for LIKE '%query%' we
-- need pg_trgm extension. This index helps with equality and prefix.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Employee_name_lower_idx"
  ON "Employee" (lower("name"));

-- CNIC exact/prefix lookups (commonly searched)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Employee_cnic_idx"
  ON "Employee" ("cnic");

-- Service number lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Employee_serviceNumber_idx"
  ON "Employee" ("serviceNumber");

-- Active employees retiring soon (dashboard retirement warnings)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Employee_active_retirement_idx"
  ON "Employee" ("status", "retirementDate", "reportingOfficerId")
  WHERE "status" = 'ACTIVE' AND "retirementDate" IS NOT NULL;

-- =============================================================================
-- ArchiveRecord: List and search optimization
-- =============================================================================

-- Archive list ordering: reportingPeriodTo DESC, createdAt DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ArchiveRecord_reportingPeriodTo_createdAt_idx"
  ON "ArchiveRecord" ("reportingPeriodTo" DESC NULLS LAST, "createdAt" DESC);

-- Source + scope compound filter (common archive list filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ArchiveRecord_source_scopeTrack_idx"
  ON "ArchiveRecord" ("source", "scopeTrack");

-- =============================================================================
-- AuditLog: Pagination and filtering
-- =============================================================================

-- Audit list pagination (createdAt DESC is the main sort)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_createdAt_desc_idx"
  ON "AuditLog" ("createdAt" DESC);

-- Action text search for audit filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_action_lower_idx"
  ON "AuditLog" (lower("action"));

-- =============================================================================
-- Notification: Unread count and recent notifications
-- =============================================================================

-- Fast unread count per user
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_userId_unread_idx"
  ON "Notification" ("userId", "createdAt" DESC)
  WHERE "readAt" IS NULL;

-- =============================================================================
-- Session: Active session lookups
-- =============================================================================

-- Active sessions for a user (not revoked, not expired)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_userId_active_idx"
  ON "Session" ("userId", "expiresAt")
  WHERE "revokedAt" IS NULL;

-- =============================================================================
-- AuthChallenge: Cleanup of expired challenges
-- =============================================================================

-- Expired + unconsumed challenges for periodic cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuthChallenge_expired_unconsumed_idx"
  ON "AuthChallenge" ("expiresAt")
  WHERE "consumedAt" IS NULL;
