# Project conventions

- Bun + Turborepo workspaces. Never run `bun run qa` locally.
- API features live in `apps/api/src/api/<feature>/`. Each must contain `<feature>.service.ts`, `.controller.ts`, `.router.ts`, `.types.ts` and `utils/`.
- Routers define HTTP wiring; controllers parse input and serialize responses; services own behavior. Core holds infrastructure. Common holds reusable transport/error helpers.
- Core/common may not import API features. Services may not import controllers, routers, or Express. All imports are checked by `bun run lint`.
- Model output and ticket content are untrusted. Validate output before persistence. Never permit model-directed database operations.
- Use focused tests and browser verification. Never commit secrets or generated dependencies.
- Commits must pass commitlint using Conventional Commits. No generated attribution or coauthor trailers.
- Make small checkpoint commits after completing and validating each layer.

- UI changes must support light/dark/system appearance, Base UI keyboard behavior, persisted theme choice, and reduced motion. Verify both themes in the browser.
