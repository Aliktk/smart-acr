-- Workflow, search, and notification routing indexes
CREATE INDEX "Employee_officeId_idx" ON "Employee"("officeId");
CREATE INDEX "Employee_zoneId_idx" ON "Employee"("zoneId");
CREATE INDEX "Employee_wingId_idx" ON "Employee"("wingId");
CREATE INDEX "Employee_reportingOfficerId_idx" ON "Employee"("reportingOfficerId");
CREATE INDEX "Employee_countersigningOfficerId_idx" ON "Employee"("countersigningOfficerId");

CREATE INDEX "AcrRecord_employeeId_idx" ON "AcrRecord"("employeeId");
CREATE INDEX "AcrRecord_initiatedById_idx" ON "AcrRecord"("initiatedById");
CREATE INDEX "AcrRecord_reportingOfficerId_idx" ON "AcrRecord"("reportingOfficerId");
CREATE INDEX "AcrRecord_countersigningOfficerId_idx" ON "AcrRecord"("countersigningOfficerId");
CREATE INDEX "AcrRecord_currentHolderId_workflowState_idx" ON "AcrRecord"("currentHolderId", "workflowState");
CREATE INDEX "AcrRecord_workflowState_dueDate_idx" ON "AcrRecord"("workflowState", "dueDate");

CREATE INDEX "AcrTimelineEntry_acrRecordId_createdAt_idx" ON "AcrTimelineEntry"("acrRecordId", "createdAt");
CREATE INDEX "AcrTimelineEntry_actorId_createdAt_idx" ON "AcrTimelineEntry"("actorId", "createdAt");

CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "Notification_acrRecordId_createdAt_idx" ON "Notification"("acrRecordId", "createdAt");
