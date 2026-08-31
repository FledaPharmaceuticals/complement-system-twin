# C3 Safe Client Browser Regression

This procedure exercises the exact worktree UI against the real HTTPS API without changing DNS or deploying GitHub Pages. The helper accepts browser traffic only on `127.0.0.1` and proxies only `/health` and `/v1/*` to the fixed upstream `https://api.twins.fledausa.com`.

## Start

```sh
node scripts/serveC3BrowserRegression.mjs
```

Open `http://127.0.0.1:8766/?fledaApi=trial`. The query parameter is required; opening the page without it must keep the JavaScript teaching model as the default.

## Acceptance checks

1. Confirm the result source reports `API verified` for each of normal, AMD, PNH, aHUS, C3G, and sepsis.
2. Confirm the model version shown for an API result is the opaque API version, not the JavaScript version.
3. Move one parameter rapidly at least eight times. Read `http://127.0.0.1:8766/__c3_api_requests` before and after; one debounced request should be added.
4. Select IgA nephropathy. It must remain on the public teaching model, report that it is outside API parity scope, and add no API request.
5. Confirm the dynamic chart, vital signs, organ outputs, playback, experiment controls, and literature catalog remain present and JavaScript-managed.
6. At 1440 by 1000 and 390 by 844, confirm no horizontal overflow or overlap between simulation and literature sections.
7. Confirm the browser console has no errors or warnings.
8. Open the same page without `?fledaApi=trial` and confirm the result source is `Public teaching model · JavaScript` with no API request.

Record results in `reports/c3-safe-client-task13-browser-regression.json`. Production CORS and protocol error behavior are verified separately by `scripts/verifyC3PublicApi.mjs`; this browser helper is not a deployment component.
