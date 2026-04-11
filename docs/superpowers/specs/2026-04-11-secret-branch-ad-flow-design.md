# Secret Branch AD-First Verification Flow — Design Spec

**Date:** 2026-04-11
**Feature:** Revised Secret Branch workflow — AD reviews first, then assigns a DA for final completion

---

## Goal

Change the Secret Branch workflow so the Assistant Director (AD) is the first person to receive and review an ACR after the Countersigning Officer submits it, rather than a desk assistant. The AD then assigns the ACR to a specific DA desk (DA1–DA4) for final detailed review and archival completion.

## Revised Flow

```
Clerk → RO → CSO
            ↓
            submit_to_secret_branch
            ↓
  PENDING_SECRET_BRANCH_REVIEW   ← AD reviews, holds ACR
            ↓
            complete_secret_branch_review  (AD selects DA code)
            ↓
  PENDING_SECRET_BRANCH_VERIFICATION  ← assigned DA holds ACR
            ↓
            verify_secret_branch   (DA marks complete)
            ↓
          ARCHIVED
```

No new workflow states are added. The two existing Secret Branch states are reused with swapped ownership.

---

## Architecture

### State Semantics (changed)

| State | Old meaning | New meaning |
|---|---|---|
| `PENDING_SECRET_BRANCH_REVIEW` | DA initial review | AD reviews |
| `PENDING_SECRET_BRANCH_VERIFICATION` | AD verifies | Assigned DA completes |

### DB Field Semantics (changed timing, not structure)

No new Prisma columns are added. Existing columns are populated at different points in the flow:

| Field | Previously set at | Now set at |
|---|---|---|
| `secretBranchAllocatedToId` | `submit_to_secret_branch` (DA user) | `complete_secret_branch_review` (DA user chosen by AD) |
| `secretBranchDeskCode` | `submit_to_secret_branch` (DA code) | `complete_secret_branch_review` (DA code chosen by AD) |
| `secretBranchVerifiedById` | `verify_secret_branch` (AD user) | `complete_secret_branch_review` (AD user) |
| `secretBranchVerifiedAt` | `verify_secret_branch` | `complete_secret_branch_review` |
| `secretBranchReviewedAt` | `complete_secret_branch_review` | `verify_secret_branch` |

### Secret Branch Card (frontend) — fields unchanged

The card labels stay the same. The data just populates at the right time now:

```
Desk Reviewer     → DA assigned by AD (secretBranchAllocatedTo.displayName)
Desk Code         → DA code chosen by AD (secretBranchDeskCode: DA1–DA4)
Review Date       → when DA marks complete (secretBranchReviewedAt)
Verified by (AD)  → AD who reviewed first (secretBranchVerifiedBy.displayName)
Verification Date → when AD assigned DA (secretBranchVerifiedAt)
Status            → Pending Review | Pending DA Completion | Verified
```

---

## Backend Changes

### 1. `transition-acr.dto.ts`

Add an optional field for the DA code that the AD selects:

```ts
@IsOptional()
@IsEnum(SecretBranchDeskCode)
targetDeskCode?: SecretBranchDeskCode;
```

Validation: when `action === "complete_secret_branch_review"`, `targetDeskCode` is required (validated in the service, throws `BadRequestException` if missing).

### 2. `security.utils.ts` — `canTransitionAcr()`

| Action | Old check | New check |
|---|---|---|
| `complete_secret_branch_review` | `hasSecretBranchAccess(user) && currentHolderId === user.id` | `isSecretBranchVerifier(user) && currentHolderId === user.id` |
| `verify_secret_branch` | `isSecretBranchVerifier(user) && currentHolderId === user.id` | `hasSecretBranchAccess(user) && currentHolderId === user.id` |

### 3. `acr.service.ts` — `resolveSecretBranchAssignment()` and `transition()`

**`submit_to_secret_branch`:**
- Current: routes to `reviewDeskUser` (DA)
- New: routes to `verificationUser` (AD, `canVerify: true`)
- `secretBranchAllocatedToId`: NOT set here (set later by AD)
- `secretBranchDeskCode`: NOT set here (set later by AD)
- `currentHolderId`: AD user id

**`complete_secret_branch_review`** (AD action):
- Requires `dto.targetDeskCode` (throws `BadRequestException` if missing)
- Resolves DA user for the chosen desk code (find active user with matching desk and `SECRET_BRANCH` role)
- Sets: `secretBranchVerifiedById = user.id` (AD), `secretBranchVerifiedAt = now`
- Sets: `secretBranchDeskCode = dto.targetDeskCode`, `secretBranchAllocatedToId = resolved DA user id`
- `currentHolderId = resolved DA user id`
- Transitions to `PENDING_SECRET_BRANCH_VERIFICATION`

**`verify_secret_branch`** (DA action):
- Sets: `secretBranchReviewedAt = now`
- Keeps: `archivedAt = now`, `completedDate = now` (already in place)
- Transitions to `ARCHIVED`

### 4. `acr.service.ts` — `ACR_SUMMARY_INCLUDE` (already includes `secretBranchVerifiedBy: true`)

No change needed. The `secretBranchVerifiedBy` user is already fetched.

### 5. Notification updates

- `submit_to_secret_branch`: notify AD user (was: notify DA user)
- `complete_secret_branch_review`: notify assigned DA user (was: notify AD verifier)
- `verify_secret_branch`: notify employee (unchanged)

---

## Frontend Changes

### 1. `page.tsx` — Permission variables

```ts
// AD: can do step 1 (review + assign DA) — requires canVerify
const canReviewAsSecretBranch =
  activeRoleCode === "SECRET_BRANCH" &&
  data?.workflowState === "Pending Secret Branch Review" &&
  Boolean(user?.secretBranchProfile?.canVerify);

// DA: can do step 2 (mark complete) — any Secret Branch user holding the ACR
const canVerifyAsSecretBranch =
  activeRoleCode === "SECRET_BRANCH" &&
  data?.workflowState === "Pending Secret Branch Verification" &&
  !user?.secretBranchProfile?.canVerify; // DA, not AD
```

> Note: `canReturnToClerk`, `canReturnToReporting`, `canReturnToCountersigning` remain available to both AD and DA.

### 2. `page.tsx` — AD review action (inline DA selection panel)

Replace the "Complete Secret Branch Review" button with an inline expandable panel that appears when `canReviewAsSecretBranch`. The panel contains:
- A `<select>` dropdown with options: DA1, DA2, DA3, DA4
- A "Verify & Assign" button that calls `handleWorkflowAction({ action: "complete_secret_branch_review", targetDeskCode: selectedCode })`
- Validation: button disabled until a DA code is selected

### 3. `page.tsx` — DA action button

Rename "Verify & Archive" → "Mark Complete & Archive" for `canVerifyAsSecretBranch`.

### 4. `api/client.ts` — `transitionAcr()`

Add `targetDeskCode?: SecretBranchDeskCode` to the payload type.

### 5. `contracts.ts`

Add `targetDeskCode?: SecretBranchDeskCode` to `TransitionAcrPayload` (or equivalent type passed to `transitionAcr`).

---

## AD Signature — Settings Pipeline

No new upload infrastructure needed. The AD uploads their Signature and Stamp through the existing Settings → "Reusable Signature & Official Stamp" section, which uses the same `POST /user-assets/me/SIGNATURE` endpoint already used by Reporting Officers and Countersigning Officers.

To show the AD's signature in the ACR detail response:
- Extend `ACR_SUMMARY_INCLUDE` to include `secretBranchVerifiedBy: { include: { userAssets: ... } }` (same pattern as `reportingOfficer.userAssets`)
- Add `secretBranch.verifierAssets: { signature, stamp }` to `mapAcr()` output (same `groupUserAssets()` pattern)
- Add `secretBranch.verifierAssets` to the frontend `AcrSummary.secretBranch` type
- The AD's signature/stamp appears in the **Secret Branch Verification card** (not the digital form replica), shown after verification is complete — same compact image display as reviewer assets

---

## Validation Rules

- `complete_secret_branch_review` without `targetDeskCode` → `BadRequestException: "Please select a DA desk to assign this ACR."`
- `complete_secret_branch_review` with no active user found at the target desk → `BadRequestException: "No active Secret Branch staff found at the selected desk."`
- Workflow state guard on both actions (existing `canTransitionAcr` check)

---

## Out of Scope

- No changes to the digital form replica or form field bindings for AD signature (can be added later when form templates are updated)
- No changes to return actions (`return_to_clerk`, `return_to_reporting`, `return_to_countersigning`) — both AD and DA retain these
- No changes to archive, audit, or notification structure beyond target user changes noted above
