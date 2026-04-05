# Workflow Rules

## Supported state model

- `Draft`
- `Pending Reporting`
- `Pending Countersigning`
- `Submitted to Secret Branch`
- `Archived`
- `Returned`

`Overdue` is treated as a derived condition rather than a standalone persisted state.

## Default route

For most template families:

`Clerk -> Reporting Officer -> Countersigning Officer -> Secret Branch -> Archive`

## APS / Stenotypist exception

For `APS_STENOTYPIST` records:

`Clerk -> Reporting Officer -> Secret Branch -> Archive`

This exception is enforced in the workflow service and covered by unit tests.

## Transition safeguards

- Invalid stage skips are rejected server-side.
- Archived records do not continue through active workflow timers.
- Returned records move back to clerk correction handling.
- Current-holder reassignment is updated during each valid transition.

## Audit expectations

Each meaningful transition also writes:

- a timeline entry for the record view
- an audit event for investigation and compliance

## Archive behavior

On archival, the API creates or updates an archive snapshot record with a document path and immutable metadata placeholder. This gives the system a clean seam for introducing full PDF rendering and content hashing without changing the upstream workflow contract.
