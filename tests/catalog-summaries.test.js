const test = require("node:test");
const assert = require("node:assert/strict");
const { buildBootstrapData, buildHomeData } = require("../backend/data/catalog-summaries");

const data = {
  rules: [{ id: "rule-1", title: "规则", text: "说明" }],
  scripts: [{ id: "s1", name: "剧本", detail: { hidden: true } }],
  roles: [{ id: "r1", name: "角色", type: "townsfolk", detail: { hidden: true } }],
  jinxes: [{ id: "j1", name: "相克", rule: "规则" }],
  terms: [{ id: "t1", name: "术语", category: "状态", detail: { hidden: true } }],
};

test("home data contains only rules and collection counts", () => {
  assert.deepEqual(buildHomeData(data), {
    rules: data.rules,
    counts: { scripts: 1, roles: 1, jinxes: 1, terms: 1 },
  });
});

test("bootstrap data removes heavy detail fields", () => {
  const bootstrap = buildBootstrapData(data);
  assert.equal(bootstrap.scripts[0].detail, undefined);
  assert.equal(bootstrap.roles[0].detail, undefined);
  assert.equal(bootstrap.terms[0].detail, undefined);
  assert.equal(bootstrap.jinxes[0].rule, "规则");
});
