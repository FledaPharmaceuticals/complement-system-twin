import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { runComplementSimulation } from "../src/simulation.js";
import { PUBLIC_SIMULATION_OUTPUT_FIELDS } from "../src/serverSimulationContract.js";

const fixture = JSON.parse(await readFile(
  new URL("../fixtures/c3-safe-simulation/server-differential-vectors.json", import.meta.url),
  "utf8"
));

test("pins differential vectors to the reviewed server and JavaScript engine revisions", () => {
  assert.equal(fixture.serverCommit, "b7bb1cccea955a5dd62a54613facfd1b03471e69");
  assert.equal(fixture.javascriptSha256, "5ffc2e1ac322e28e68becab0b06078104b4694a914357b7d2886fbf4db7c0fc5");
  assert.equal(fixture.numericTolerance, 1e-9);
  assert.ok(fixture.vectors.length >= 30);
  assert.ok(fixture.vectors.some((vector) => vector.kind === "boundary"));
  assert.ok(fixture.vectors.some((vector) => vector.kind === "random"));
});

test("matches every server-generated random and boundary vector within 1e-9", () => {
  for (const vector of fixture.vectors) {
    const actual = runComplementSimulation(vector.input);
    for (const key of PUBLIC_SIMULATION_OUTPUT_FIELDS) {
      if (typeof vector.outputs[key] === "number") {
        assert.ok(
          Math.abs(actual[key] - vector.outputs[key]) <= fixture.numericTolerance,
          `${vector.id}.${key}: expected ${vector.outputs[key]}, received ${actual[key]}`
        );
      } else {
        assert.equal(actual[key], vector.outputs[key], `${vector.id}.${key}`);
      }
    }
  }
});
