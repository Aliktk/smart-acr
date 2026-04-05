# smart-acr

Secure on-prem web platform for digitizing FIA ACR/PER workflows with role-based access, reporting and countersigning, adverse remark handling, dossier archiving, and future AI-assisted review features.

## Current implementation slice

This pass establishes the monorepo root and the first production-facing frontend slice in `apps/web`:

- Next.js App Router workspace
- FIA-branded landing navbar
- full-bleed hero for the Smart ACR / PER portal
- document-fidelity preview showing template, workflow, and archival intent

## Run the web app

1. Install dependencies from the repo root:

   ```bash
   npm install
   ```

2. Start the Next.js app:

   ```bash
   npm run dev:web
   ```

3. Open `http://localhost:3000`

## Notes

- The supplied design link is a Figma Make file, and Figma's design-context MCP tools do not currently read Make files. This implementation therefore uses the FIA emblem, product specification, and internal document constraints as the primary concrete references for the first viewport.
- Subsequent passes can extend this workspace into the full `apps/web` + `apps/api` monorepo described in the project brief.
