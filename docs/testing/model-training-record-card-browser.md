# Model Training Record Browser Regression

Run the browser regression without installing dependencies or using the network:

```sh
NODE_PATH=/Users/johnmacpro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
PLAYWRIGHT_BROWSER_EXECUTABLE=/path/to/a-local-playwright-compatible-browser \
/Users/johnmacpro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test tests/browser/modelTrainingRecordCard.spec.js
```

The test serves the repository only on loopback, verifies the Task 10 test-only snapshot using Web Crypto before any populated rendering, and writes deterministic desktop and mobile evidence to `test-output/model-training-record-card/`. The test fixture and JWK are never used by the production page.

When no compatible local browser executable is present, the test reports a documented skip rather than downloading a browser. The production page test still requires its default unavailable state; populated visual verification can be performed with the existing Codex in-app browser while the test artifact remains ready for a Playwright-capable environment.
