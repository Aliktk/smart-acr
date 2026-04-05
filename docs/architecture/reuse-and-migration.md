# Reuse And Migration Notes

## Reused from the earlier Figma-tool build

- FIA color palette and token structure
- Logo treatment and navigation shell feel
- Status chips, stat cards, and timeline patterns
- The printable ACR form components for the supported families
- Page composition cues for dashboard, queue, search, archive, notifications, and settings

## Rewritten for production safety

- Router migration from client-only routing to Next.js App Router
- Removal of prototype-only Supabase assumptions
- Removal of mock in-memory business state as the source of truth
- Backend session handling, role enforcement, and workflow validation
- Database-backed ACR, employee, archive, notification, and audit models

## Migration boundaries

The old `figma-make-files/` directory was a reference-only source. Relevant assets and UI building blocks were extracted into `frontend/src`, and the real project now lives entirely under `backend/`, `frontend/`, `docs/`, and `infra/`.

## Styling decisions

- The FIA navy and cyan palette remains the primary visual language.
- External live font imports were removed from the shared UI layer so the system remains stable in restricted internal environments.
- The form templates keep their document-style layout instead of being redesigned into dashboard cards.
