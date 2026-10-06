# Public deployment

The app needs no API keys, database service, GPU server, or inference billing. The GitHub and Render accounts belong to the submitter.

## Live deployment

- Public app: https://pocket-wild.onrender.com/
- Source: https://github.com/sneaxhuh/pocket-wild
- Render Static Site: `srv-db2b988m7kps73e7kji0`, in the submitter's confirmed “My Workspace.”
- Branch `main`; build `npm ci && npm test && npm run build`; publish directory `dist`.
- Build environment: `NODE_VERSION=22.21.0`, `SKIP_INSTALL_DEPS=true`.

The service was created directly through the Render integration. Its automatic deployments run on commits, with unit checks inside the build. The alternative Blueprint uses `checksPass` and adds custom headers; direct creation does not automatically import every `render.yaml` setting. No database, paid GPU service, or inference key was provisioned. The separately hosted Sites preview remains private.

## GitHub

Create a new **public** repository for this challenge and upload this directory's source, lockfile, licence, docs, and tests. Do not upload `node_modules`, personal notes/photos, test browser profiles, or credentials. Retain the project history where possible. The generated worker/runtime assets are ignored intentionally; deployment builds them.

The public repository was initialized by the submitter and populated with the tested source snapshot through the GitHub integration. The original development history remains in the local/Sites checkout; the publication commit records its source SHA. Private-preview configuration was excluded. A remote named `github` links the original checkout to the public repo, but their histories differ: do not force-push one over the other. For ordinary contributions, clone the public repo; use reviewed, non-destructive synchronization for the original checkout.

## Render

1. Sign in to Render and connect the public GitHub repository.
2. Create a Blueprint from `render.yaml`, or choose **New → Static Site**.
3. For a manual Static Site: build `npm ci && npm test && npm run build`, publish directory `dist`, Node `22.21.0`, `SKIP_INSTALL_DEPS=true`. No start command. No paid GPU or web-server service is needed.
4. Wait for a successful deployment. Save the actual public `onrender.com` link.
5. In a private/incognito browser with no account session, confirm the UI loads, Gemma downloads, the three missions generate, and the journal works. Test offline on this same origin; caches are separate from localhost/the private preview.

No blanket SPA rewrite is configured: a missing worker or runtime piece must return 404, not an HTML page masquerading as JavaScript. Runtime modules must be served as JavaScript and `.bin` pieces as binary assets (`application/octet-stream` is suitable). A Blueprint-created service waits for repository checks; the current directly created service deploys on commits and runs unit tests during its build. Inspect Render and Actions separately if a later update fails.

References: [Render Static Sites](https://render.com/docs/static-sites), [Blueprint schema](https://render.com/docs/blueprint-spec). A Blueprint file is deployment preparation, **not proof of a live Render deployment**.

## Existing private preview

Sites hosting remains owner-private. It can be used to review the app, but judges cannot necessarily open it. Do not use that private link as the only challenge demo. Publish a public Render site or provide a publicly accessible video and public source repository.

The preview host limits each static file to 25 MiB. `npm run build` splits the 26,861,777-byte ONNX runtime into four hash-named pieces of at most 8 MiB and packages only the runtime variant the app uses. The worker verifies the reassembled binary against the manifest's SHA-256 before execution. All pieces are cached with the app shell; model weights remain separately cached by Transformers.js. The build checks every deployed file against the size limit, so this packaging failure is caught before publication. The original dependency binary is unchanged and can always be rebuilt from the lockfile.
