# Secret Branch AD-First Verification Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the Secret Branch workflow so the AD reviews first (step 1) and assigns a DA, then the DA marks the ACR complete (step 2), replacing the old DA-first order.

**Architecture:** No new Prisma columns or workflow states. Existing fields (`secretBranchVerifiedById`, `secretBranchVerifiedAt`, `secretBranchDeskCode`, `secretBranchAllocatedToId`, `secretBranchReviewedAt`) are written at different points. The DTO gains one optional field (`targetDeskCode`) so the AD's dropdown selection reaches the backend.

**Tech Stack:** NestJS + Prisma (backend), Next.js 15 App Router + TanStack Query (frontend), class-validator DTOs.

---

## File Map

| File | Change |
|------|--------|
| `backend/src/modules/acr/dto/transition-acr.dto.ts` | Add `targetDeskCode?: SecretBranchDeskCode` field |
| `backend/src/modules/acr/acr.controller.ts` | Pass `dto.targetDeskCode` to service |
| `backend/src/helpers/security.utils.ts` | Swap `canVerify` requirements between the two actions |
| `backend/src/modules/acr/acr.service.ts` | Reroute submit → AD, complete_review → assigns DA, verify → DA action |
| `frontend/src/api/client.ts` | Add `targetDeskCode?` to `transitionAcr` payload type |
| `frontend/src/app/(portal)/acr/[id]/page.tsx` | Fix permissions, add DA dropdown panel, rename DA button |

---

### Task 1: Add `targetDeskCode` to `TransitionAcrDto`

**Files:**
- Modify: `backend/src/modules/acr/dto/transition-acr.dto.ts`

- [ ] **Step 1: Open the file and read it**

Current content (lines 1–31):
```ts
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import type { AcrAction } from "../../workflow/workflow.service";

export class TransitionAcrDto {
  @IsIn([...])
  action!: AcrAction;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;
}
```

- [ ] **Step 2: Add the field**

Replace the full file content with:

```ts
import { IsEnum, IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { SecretBranchDeskCode } from "@prisma/client";
import type { AcrAction } from "../../workflow/workflow.service";

export class TransitionAcrDto {
  @IsIn([
    "save_draft",
    "forward_to_admin_office",
    "admin_forward_to_piab",
    "intake_accept",
    "intake_return",
    "resubmit_after_rectification",
    "submit_to_reporting",
    "forward_to_countersigning",
    "submit_to_secret_branch",
    "complete_secret_branch_review",
    "verify_secret_branch",
    "return_to_clerk",
    "return_to_reporting",
    "return_to_countersigning",
  ])
  action!: AcrAction;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(SecretBranchDeskCode)
  targetDeskCode?: SecretBranchDeskCode;
}
```

- [ ] **Step 3: Build check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/acr/dto/transition-acr.dto.ts
git commit -m "feat: add targetDeskCode to TransitionAcrDto for AD→DA assignment"
```

---

### Task 2: Pass `targetDeskCode` through the controller

**Files:**
- Modify: `backend/src/modules/acr/acr.controller.ts`

- [ ] **Step 1: Update the transition call**

Find line 41 in `acr.controller.ts`:
```ts
return this.acrService.transition(user.id, user.activeRole, id, dto.action, dto.remarks, dto.formData, ipAddress);
```

Replace with:
```ts
return this.acrService.transition(user.id, user.activeRole, id, dto.action, dto.remarks, dto.formData, ipAddress, dto.targetDeskCode);
```

- [ ] **Step 2: Build check**

```bash
cd backend && npx tsc --noEmit
```

Expected: type error on `transition()` — argument count mismatch. That's expected; we fix the service in the next task.

- [ ] **Step 3: Commit after Task 3 passes (skip commit here — pair with Task 3)**

---

### Task 3: Swap permission checks in `security.utils.ts`

**Files:**
- Modify: `backend/src/helpers/security.utils.ts`

- [ ] **Step 1: Read the current checks (lines 315–321)**

```ts
if (action === "complete_secret_branch_review") {
  return hasSecretBranchAccess(user) && acr.currentHolderId === user.id;
}

if (action === "verify_secret_branch") {
  return isSecretBranchVerifier(user) && acr.currentHolderId === user.id;
}
```

- [ ] **Step 2: Swap the helper functions**

Change:
```ts
if (action === "complete_secret_branch_review") {
  return hasSecretBranchAccess(user) && acr.currentHolderId === user.id;
}

if (action === "verify_secret_branch") {
  return isSecretBranchVerifier(user) && acr.currentHolderId === user.id;
}
```

To:
```ts
if (action === "complete_secret_branch_review") {
  return isSecretBranchVerifier(user) && acr.currentHolderId === user.id;
}

if (action === "verify_secret_branch") {
  return hasSecretBranchAccess(user) && acr.currentHolderId === user.id;
}
```

- [ ] **Step 3: Verify the helper definitions are already correct**

`isSecretBranchVerifier` (line 125–127) checks `canVerify === true` — this is the AD.
`hasSecretBranchAccess` (line 117–119) checks active SECRET_BRANCH role — any desk user.

No changes needed to those helpers.

- [ ] **Step 4: Build check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors (both helpers already exist and are typed correctly).

- [ ] **Step 5: Commit**

```bash
git add backend/src/helpers/security.utils.ts backend/src/modules/acr/acr.controller.ts
git commit -m "feat: swap secret branch permission checks — AD owns complete_review, DA owns verify"
```

---

### Task 4: Reroute the workflow logic in `acr.service.ts`

This is the main backend change. Four things change: (1) `transition()` signature, (2) routing for `submit_to_secret_branch`, (3) all field assignments for `complete_secret_branch_review` and `verify_secret_branch`, (4) notifications.

**Files:**
- Modify: `backend/src/modules/acr/acr.service.ts`

---

#### Step 4a — Update `transition()` signature

- [ ] Find (line 833–841):
```ts
async transition(
  userId: string,
  activeRole: UserRole,
  acrId: string,
  action: AcrAction,
  remarks?: string,
  formData?: Record<string, unknown>,
  ipAddress = "0.0.0.0",
) {
```

Replace with:
```ts
async transition(
  userId: string,
  activeRole: UserRole,
  acrId: string,
  action: AcrAction,
  remarks?: string,
  formData?: Record<string, unknown>,
  ipAddress = "0.0.0.0",
  targetDeskCode?: SecretBranchDeskCode,
) {
```

`SecretBranchDeskCode` is already imported at the top of `acr.service.ts` (it is used by `resolveSecretBranchAssignment`). Confirm the import exists:

```bash
grep -n "SecretBranchDeskCode" backend/src/modules/acr/acr.service.ts | head -5
```

If it is not imported, add it to the Prisma client import line.

---

#### Step 4b — Change `resolveSecretBranchAssignment` call scope

- [ ] Find (lines 911–913):
```ts
const secretBranchAssignment = action === "submit_to_secret_branch" || action === "complete_secret_branch_review"
  ? await this.resolveSecretBranchAssignment(acr.templateVersion.family)
  : null;
```

Replace with (only call for `submit_to_secret_branch` now):
```ts
const secretBranchAssignment = action === "submit_to_secret_branch"
  ? await this.resolveSecretBranchAssignment(acr.templateVersion.family)
  : null;
```

---

#### Step 4c — Add DA user lookup for `complete_secret_branch_review`

- [ ] Immediately after the `secretBranchAssignment` block (after line 913), add:

```ts
let assignedDaUser: { id: string } | null = null;
if (action === "complete_secret_branch_review") {
  if (!targetDeskCode) {
    throw new BadRequestException("Please select a DA desk to assign this ACR.");
  }
  const daProfile = await this.prisma.secretBranchStaffProfile.findFirst({
    where: {
      deskCode: targetDeskCode,
      isActive: true,
      user: { isActive: true },
    },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  if (!daProfile) {
    throw new BadRequestException("No active Secret Branch staff found at the selected desk.");
  }
  assignedDaUser = daProfile.user;
}
```

---

#### Step 4d — Update the `submit_to_secret_branch` guard

- [ ] Find (line ~919):
```ts
if (action === "submit_to_secret_branch" && !secretBranchAssignment?.reviewDeskUser) {
  throw new BadRequestException("No active Secret Branch review desk is configured for this template family.");
}
```

Replace with:
```ts
if (action === "submit_to_secret_branch" && !secretBranchAssignment?.verificationUser) {
  throw new BadRequestException("No active Secret Branch Assistant Director is configured for this template family.");
}
```

- [ ] Delete the old `complete_secret_branch_review` guard (was line ~923):
```ts
if (action === "complete_secret_branch_review" && !secretBranchAssignment?.verificationUser) {
  throw new BadRequestException("No active Assistant Director Secret Branch verifier is configured.");
}
```

This validation is now handled inside the `assignedDaUser` block above.

---

#### Step 4e — Update `nextHolderId` chain

- [ ] Find (lines ~951–954):
```ts
: action === "submit_to_secret_branch"
  ? secretBranchAssignment?.reviewDeskUser?.id ?? null
  : action === "complete_secret_branch_review"
    ? secretBranchAssignment?.verificationUser?.id ?? acr.currentHolderId
```

Replace with:
```ts
: action === "submit_to_secret_branch"
  ? secretBranchAssignment?.verificationUser?.id ?? null
  : action === "complete_secret_branch_review"
    ? assignedDaUser?.id ?? acr.currentHolderId
```

---

#### Step 4f — Update the DB field assignments

- [ ] Find the block (lines ~1006–1018):
```ts
archivedAt: action === "verify_secret_branch" ? new Date() : acr.archivedAt,
completedDate: action === "verify_secret_branch" ? new Date() : acr.completedDate,
secretBranchDeskCode: action === "submit_to_secret_branch"
  ? secretBranchAssignment?.reviewDeskCode ?? acr.secretBranchDeskCode
  : acr.secretBranchDeskCode,
secretBranchAllocatedToId: action === "submit_to_secret_branch"
  ? secretBranchAssignment?.reviewDeskUser?.id ?? acr.secretBranchAllocatedToId
  : acr.secretBranchAllocatedToId,
secretBranchVerifiedById: action === "verify_secret_branch" ? user.id : acr.secretBranchVerifiedById,
secretBranchSubmittedAt: action === "submit_to_secret_branch" ? new Date() : acr.secretBranchSubmittedAt,
secretBranchReviewedAt: action === "complete_secret_branch_review" ? new Date() : acr.secretBranchReviewedAt,
secretBranchVerifiedAt: action === "verify_secret_branch" ? new Date() : acr.secretBranchVerifiedAt,
secretBranchVerificationNotes: action === "verify_secret_branch" ? remarks ?? acr.secretBranchVerificationNotes : acr.secretBranchVerificationNotes,
```

Replace with:
```ts
archivedAt: action === "verify_secret_branch" ? new Date() : acr.archivedAt,
completedDate: action === "verify_secret_branch" ? new Date() : acr.completedDate,
secretBranchDeskCode: action === "complete_secret_branch_review"
  ? targetDeskCode ?? acr.secretBranchDeskCode
  : acr.secretBranchDeskCode,
secretBranchAllocatedToId: action === "complete_secret_branch_review"
  ? assignedDaUser?.id ?? acr.secretBranchAllocatedToId
  : acr.secretBranchAllocatedToId,
secretBranchVerifiedById: action === "complete_secret_branch_review" ? user.id : acr.secretBranchVerifiedById,
secretBranchSubmittedAt: action === "submit_to_secret_branch" ? new Date() : acr.secretBranchSubmittedAt,
secretBranchReviewedAt: action === "verify_secret_branch" ? new Date() : acr.secretBranchReviewedAt,
secretBranchVerifiedAt: action === "complete_secret_branch_review" ? new Date() : acr.secretBranchVerifiedAt,
secretBranchVerificationNotes: action === "verify_secret_branch" ? remarks ?? acr.secretBranchVerificationNotes : acr.secretBranchVerificationNotes,
```

Key changes in this block:
- `secretBranchDeskCode` now set at `complete_secret_branch_review` (not `submit_to_secret_branch`)
- `secretBranchAllocatedToId` now set at `complete_secret_branch_review` (not `submit_to_secret_branch`)
- `secretBranchVerifiedById` now set at `complete_secret_branch_review` (not `verify_secret_branch`)
- `secretBranchReviewedAt` now set at `verify_secret_branch` (not `complete_secret_branch_review`)
- `secretBranchVerifiedAt` now set at `complete_secret_branch_review` (not `verify_secret_branch`)

---

#### Step 4g — Update notifications

- [ ] Find (lines ~1084–1102):
```ts
if (action === "submit_to_secret_branch") {
  await this.createWorkflowNotification({
    userId: secretBranchAssignment?.reviewDeskUser?.id,
    acrId: acr.id,
    ...
  });
}

if (action === "complete_secret_branch_review") {
  await this.createWorkflowNotification({
    userId: secretBranchAssignment?.verificationUser?.id,
    acrId: acr.id,
    ...
  });
}
```

Replace with:
```ts
if (action === "submit_to_secret_branch") {
  await this.createWorkflowNotification({
    userId: secretBranchAssignment?.verificationUser?.id,
    acrId: acr.id,
    type: "WORKFLOW_ACTION",
    title: "New ACR for Secret Branch Review",
    message: `ACR ${acr.acrNo} has been submitted to Secret Branch for your review.`,
  });
}

if (action === "complete_secret_branch_review") {
  await this.createWorkflowNotification({
    userId: assignedDaUser?.id,
    acrId: acr.id,
    type: "WORKFLOW_ACTION",
    title: "ACR Assigned to Your Desk",
    message: `ACR ${acr.acrNo} has been reviewed by the AD and assigned to your desk for completion.`,
  });
}
```

To get the exact type, title, and message shape used by the existing notification calls, read the nearby notification blocks in the service and copy the pattern exactly. The key change is `userId` target.

---

#### Step 4h — Build and verify

- [ ] **Build check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit**

```bash
git add backend/src/modules/acr/acr.service.ts
git commit -m "feat: reroute secret branch flow — CSO → AD → DA, AD assigns desk on complete_review"
```

---

### Task 5: Update `transitionAcr` in `frontend/src/api/client.ts`

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add `SecretBranchDeskCode` to the import list**

The import block starts at line 3. `SecretBranchDeskCode` is already exported from `@/types/contracts`. Add it to the named imports:

```ts
import type {
  AcrAssetKind,
  AcrDetail,
  AcrFormData,
  AcrSummary,
  ...
  SecretBranchDeskCode,
  ...
} from "@/types/contracts";
```

- [ ] **Step 2: Update the `transitionAcr` function signature**

Find (lines ~271–276):
```ts
export function transitionAcr(id: string, payload: { action: string; remarks?: string; formData?: AcrFormData }) {
  return apiFetch<AcrSummary>(`/acrs/${id}/transition`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
```

Replace with:
```ts
export function transitionAcr(id: string, payload: { action: string; remarks?: string; formData?: AcrFormData; targetDeskCode?: SecretBranchDeskCode }) {
  return apiFetch<AcrSummary>(`/acrs/${id}/transition`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors (the new field is optional, so existing callers are still valid).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add targetDeskCode to transitionAcr frontend API call"
```

---

### Task 6: Update `page.tsx` — permissions, DA selector, button rename

**Files:**
- Modify: `frontend/src/app/(portal)/acr/[id]/page.tsx`

---

#### Step 6a — Fix `canReviewAsSecretBranch` (AD-only check)

- [ ] Find line 226:
```ts
const canReviewAsSecretBranch = activeRoleCode === "SECRET_BRANCH" && data?.workflowState === "Pending Secret Branch Review";
```

Replace with:
```ts
const canReviewAsSecretBranch =
  activeRoleCode === "SECRET_BRANCH" &&
  data?.workflowState === "Pending Secret Branch Review" &&
  Boolean(user?.secretBranchProfile?.canVerify);
```

---

#### Step 6b — Fix `canVerifyAsSecretBranch` (DA check — any active desk user, NOT canVerify)

- [ ] Find line 227:
```ts
const canVerifyAsSecretBranch = activeRoleCode === "SECRET_BRANCH" && data?.workflowState === "Pending Secret Branch Verification" && Boolean(user?.secretBranchProfile?.canVerify);
```

Replace with:
```ts
const canVerifyAsSecretBranch =
  activeRoleCode === "SECRET_BRANCH" &&
  data?.workflowState === "Pending Secret Branch Verification" &&
  !user?.secretBranchProfile?.canVerify;
```

The `!canVerify` check excludes the AD from step 2 (only DAs can mark it complete).

---

#### Step 6c — Add DA desk code state

- [ ] At the top of the component, after the existing `useState` declarations, add:

```ts
const [selectedDeskCode, setSelectedDeskCode] = useState<string>("");
const [showDeskSelector, setShowDeskSelector] = useState(false);
```

---

#### Step 6d — Update `mutation.mutationFn` to accept `targetDeskCode`

- [ ] Find line 121:
```ts
mutationFn: (payload: { action: string; remarks?: string; formData?: AcrFormData }) => transitionAcr(params.id, payload),
```

Replace with:
```ts
mutationFn: (payload: { action: string; remarks?: string; formData?: AcrFormData; targetDeskCode?: string }) => transitionAcr(params.id, payload),
```

---

#### Step 6e — Update `handleWorkflowAction` to accept `targetDeskCode`

- [ ] Find line 519:
```ts
async function handleWorkflowAction(payload: { action: string; remarks?: string }) {
```

Replace with:
```ts
async function handleWorkflowAction(payload: { action: string; remarks?: string; targetDeskCode?: string }) {
```

---

#### Step 6f — Update toast messages for new flow

- [ ] Find (lines ~150–152):
```ts
: variables.action === "complete_secret_branch_review"
  ? "Desk review is complete and the record now awaits Assistant Director Secret Branch verification."
```

Replace with:
```ts
: variables.action === "complete_secret_branch_review"
  ? "The ACR has been reviewed and assigned to the selected desk for completion."
```

---

#### Step 6g — Replace the AD action button with an inline panel

- [ ] Find (lines 964–973):
```tsx
{canReviewAsSecretBranch ? (
  <button
    type="button"
    disabled={formBusy}
    onClick={() => void handleWorkflowAction({ action: "complete_secret_branch_review" })}
    className={actionButtonPrimary}
  >
    <Send size={16} />
    Complete Secret Branch Review
  </button>
) : null}
```

Replace with:
```tsx
{canReviewAsSecretBranch ? (
  showDeskSelector ? (
    <div className="flex items-center gap-2">
      <select
        value={selectedDeskCode}
        onChange={(e) => setSelectedDeskCode(e.target.value)}
        className="rounded-xl border border-[#D8DEE8] bg-white px-3 py-2 text-sm font-medium text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A1C6E]"
      >
        <option value="">Select DA Desk</option>
        <option value="DA1">DA1</option>
        <option value="DA2">DA2</option>
        <option value="DA3">DA3</option>
        <option value="DA4">DA4</option>
      </select>
      <button
        type="button"
        disabled={formBusy || !selectedDeskCode}
        onClick={() => {
          void handleWorkflowAction({
            action: "complete_secret_branch_review",
            targetDeskCode: selectedDeskCode,
          });
        }}
        className={actionButtonPrimary}
      >
        <Send size={16} />
        Verify & Assign
      </button>
      <button
        type="button"
        onClick={() => { setShowDeskSelector(false); setSelectedDeskCode(""); }}
        className={actionButtonSecondary}
      >
        Cancel
      </button>
    </div>
  ) : (
    <button
      type="button"
      disabled={formBusy}
      onClick={() => setShowDeskSelector(true)}
      className={actionButtonPrimary}
    >
      <Send size={16} />
      Complete Secret Branch Review
    </button>
  )
) : null}
```

---

#### Step 6h — Rename the DA action button

- [ ] Find (lines 975–984):
```tsx
{canVerifyAsSecretBranch ? (
  <button
    type="button"
    disabled={formBusy}
    onClick={() => void handleWorkflowAction({ action: "verify_secret_branch" })}
    className={actionButtonPrimary}
  >
    <Send size={16} />
    Verify & Archive
  </button>
) : null}
```

Replace with:
```tsx
{canVerifyAsSecretBranch ? (
  <button
    type="button"
    disabled={formBusy}
    onClick={() => void handleWorkflowAction({ action: "verify_secret_branch" })}
    className={actionButtonPrimary}
  >
    <Send size={16} />
    Mark Complete & Archive
  </button>
) : null}
```

---

#### Step 6i — Type-check and commit

- [ ] **Build check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit**

```bash
git add frontend/src/app/(portal)/acr/[id]/page.tsx
git commit -m "feat: AD reviews first and assigns DA desk, DA marks complete — frontend flow"
```

---

## End-to-end Test Checklist

After all tasks are committed, manually verify the following flows:

- [ ] **CSO submits to Secret Branch** — ACR moves to `Pending Secret Branch Review` and is held by the AD user (canVerify: true). AD sees the ACR in their queue.
- [ ] **AD opens the ACR** — "Complete Secret Branch Review" button is visible. "Verify & Archive" (now "Mark Complete & Archive") button is NOT visible for the AD.
- [ ] **AD clicks "Complete Secret Branch Review"** — Desk selector panel expands (DA1–DA4 dropdown).
- [ ] **AD selects a desk and clicks "Verify & Assign"** — ACR moves to `Pending Secret Branch Verification`. `secretBranchVerifiedById` is set to AD user. `secretBranchDeskCode` and `secretBranchAllocatedToId` are set to the chosen DA.
- [ ] **DA opens the ACR** — "Mark Complete & Archive" button is visible. The Secret Branch Verification card shows the AD's name as "Verified by (AD)" and the assigned desk code.
- [ ] **DA clicks "Mark Complete & Archive"** — ACR moves to `ARCHIVED`. `secretBranchReviewedAt` is set.
- [ ] **Selecting no DA desk and clicking "Verify & Assign"** — Button is disabled. Backend also throws `BadRequestException` if somehow called without `targetDeskCode`.
- [ ] **Return actions** — Both AD and DA can still use Return to Clerk / Return to Reporting / Return to Countersigning from their respective states.
