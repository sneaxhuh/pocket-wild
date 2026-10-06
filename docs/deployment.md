# Public deployment

The app needs no API keys, database service, GPU server, or inference billing. The GitHub and Render accounts belong to the submitter.

## GitHub

Create a new **public** repository for this challenge and upload this directory's source, lockfile, licence, docs, and tests. Do not upload `node_modules`, personal notes/photos, test browser profiles, or credentials. Retain the project history where possible. The generated worker/runtime assets are ignored intentionally; deployment builds them.

If using Git locally, add a **second remote named `github`** and push the existing branch. Do not replace the existing Sites source remote or force-push. If account connections are available to Codex, it can help with this after you connect them.

## Render

1. Sign in to Render and connect the public GitHub repository.
2. Create a Blueprint from `render.yaml`, or choose **New → Static Site**.
3. For a manual Static Site: build `npm ci && npm run build`, publish directory `dist`, Node `22.21.0`. No start command. No paid GPU or web-server service is needed.
4. Wait for a successful deployment. Save the actual public `onrender.com` link.
5. In a private/incognito browser with no account session, confirm the UI loads, Gemma downloads, the three missions generate, and the journal works. Test offline on this same origin; caches are separate from localhost/the private preview.

No blanket SPA rewrite is configured: a missing worker or runtime piece must return 404, not an HTML page masquerading as JavaScript. Runtime modules must be served as JavaScript and `.bin` pieces as binary assets (`application/octet-stream` is suitable). Automatic deployments wait for repository checks to pass; inspect Actions if a later push does not deploy.

References: [Render Static Sites](https://render.com/docs/static-sites), [Blueprint schema](https://render.com/docs/blueprint-spec). A Blueprint file is deployment preparation, **not proof of a live Render deployment**.

## Existing private preview

Sites hosting remains owner-private. It can be used to review the app, but judges cannot necessarily open it. Do not use that private link as the only challenge demo. Publish a public Render site or provide a publicly accessible video and public source repository.

The preview host limits each static file to 25 MiB. `npm run build` splits the 26,861,777-byte ONNX runtime into four hash-named pieces of at most 8 MiB and packages only the runtime variant the app uses. The worker verifies the reassembled binary against the manifest's SHA-256 before execution. All pieces are cached with the app shell; model weights remain separately cached by Transformers.js. The build checks every deployed file against the size limit, so this packaging failure is caught before publication. The original dependency binary is unchanged and can always be rebuilt from the lockfile.
