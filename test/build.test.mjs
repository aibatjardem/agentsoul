import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { buildAll, buildLocale, diffBuild, writeBuild } from "../tools/dist/build.js"
import { ROOT, repoCopy, write } from "./helpers.mjs"

const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version

test("build: plugin.json carries the name and the package.json version", () => {
    const files = buildLocale(ROOT, "ru", version)
    const meta = JSON.parse(files.get(".claude-plugin/plugin.json"))
    assert.equal(meta.name, "agentsoul-ru")
    assert.equal(meta.version, version)
})

test("build: marketplace lists the plugin by relative source, without a version", () => {
    const m = JSON.parse(buildAll(ROOT).get(".claude-plugin/marketplace.json"))
    assert.equal(m.name, "agentsoul")
    const ru = m.plugins.find((p) => p.name === "agentsoul-ru")
    assert.equal(ru.source, "./plugins/agentsoul-ru")
    assert.equal(ru.version, undefined)
})

test("build: {{plugin}} is replaced everywhere", () => {
    for (const [path, content] of buildLocale(ROOT, "ru", version)) {
        assert.ok(!content.includes("{{plugin}}"), path)
    }
    const agent = buildLocale(ROOT, "ru", version).get("agents/ddd-architect.md")
    assert.match(agent, /^skills: \[agentsoul-ru:architecture-guide\]$/m)
})

test("build: soul-core is the compact soul; skill soul = identity + map; setup ships templates and profiles", () => {
    const files = buildLocale(ROOT, "ru", version)
    assert.equal(files.get("hooks/soul-core.md"), readFileSync(join(ROOT, "src/locales/ru/soul/core.md"), "utf8").replaceAll("{{plugin}}", "agentsoul-ru"))
    const soul = files.get("skills/soul/SKILL.md")
    assert.match(soul, /^---\nname: soul\n/)
    assert.match(soul, /## Soul/)
    assert.match(soul, /## Skills, субагенты/)
    assert.ok(files.has("skills/setup/templates/local/rules.md"))
    assert.ok(files.has("skills/setup/profiles/blank/stack.md"))
})

test("build: --check detects a stale committed build and passes after rebuilding", () => {
    const repo = repoCopy()
    writeBuild(repo, buildAll(repo))
    assert.deepEqual(diffBuild(repo, buildAll(repo)), [])

    write(repo, "src/locales/ru/agents/task-planner.md", readFileSync(join(repo, "src/locales/ru/agents/task-planner.md"), "utf8") + "\nновая строка\n")
    write(repo, "plugins/agentsoul-ru/agents/leftover.md", "stale")
    const drift = diffBuild(repo, buildAll(repo))
    assert.deepEqual(drift, ["plugins/agentsoul-ru/agents/leftover.md", "plugins/agentsoul-ru/agents/task-planner.md"])

    writeBuild(repo, buildAll(repo))
    assert.deepEqual(diffBuild(repo, buildAll(repo)), [])
})
