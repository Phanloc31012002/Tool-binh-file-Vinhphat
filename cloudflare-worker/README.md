# DanCard update worker

The worker returns the current `online/latest.json` without making employee
computers call GitHub's API. `PhatHanhCapNhat.bat` rebuilds and deploys it after
each release is pushed.

## One-time setup

1. Create a Cloudflare account and deploy with `npx wrangler deploy` from the
   repository root. Wrangler prints the `workers.dev` URL.
2. Put `<worker-url>/latest.json` in `updater/update-config.json` before the
   next release.

The Worker contains no GitHub token and serves only public update metadata.
