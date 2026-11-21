import { test } from "node:test"
import assert from "node:assert/strict"
import { rmSync } from "node:fs"
import { join } from "node:path"
import { applyPlan, planInstall } from "../dist/kit/install.js"
import { loadKit } from "../dist/kit/kit.js"
import { validateSource, validateTarget } from "../dist/kit/validate.js"
import { CORE, append, coreCopy, read, tempDir, write } from "./helpers.mjs"

const sourceErrors = (core) => validateSource(loadKit(core)).filter((i) => i.level === "error").map((i) => `${i.where}: ${i.message}`)
const targetIssues = (t) => validateTarget(t, loadKit(CORE), "9.9.9").map((i) => `${i.level} ${i.where}: ${i.message}`)
const installed = () => {
    const t = tempDir()
    applyPlan(planInstall({ kit: loadKit(CORE), target: t, version: "9.9.9", force: false }), t)
    return t
}
const edit = (core, path, from, to) => {
    const before = read(core, path)
    assert.ok(before.includes(from), `fixture: "${from}" not found in ${path}`)
    write(core, path, before.replace(from, to))
}

test("source: the shipped kit is consistent", () => {
    assert.deepEqual(sourceErrors(CORE), [])
})

test("source: catches a skills: reference to a skill that does not exist", () => {
    const core = coreCopy()
    edit(core, "agents/ddd-architect.md", "skills: [architecture-guide]", "skills: [architecture-guide, ghost-guide]")
    assert.ok(sourceErrors(core).some((e) => /ddd-architect.*"ghost-guide" is not an installed skill/.test(e)))
})

test("source: catches name/filename mismatch, unknown tool, invalid model", () => {
    const core = coreCopy()
    edit(core, "agents/task-planner.md", "name: task-planner", "name: planner")
    edit(core, "agents/code-reviewer.md", "tools: [Read, Grep, Glob, Bash]", "tools: [Read, Hammer]")
    edit(core, "agents/api-designer.md", "model: opus", "model: gpt-5")
    const errors = sourceErrors(core)
    assert.ok(errors.some((e) => /task-planner.*name "planner" != filename/.test(e)), errors.join("\n"))
    assert.ok(errors.some((e) => /code-reviewer.*unknown tool "Hammer"/.test(e)))
    assert.ok(errors.some((e) => /api-designer.*invalid model "gpt-5"/.test(e)))
})

test("source: index must list every agent and skill, and nothing else", () => {
    const core = coreCopy()
    edit(core, "soul/agents.md", "| `release-manager` | RW |", "| `release-boss` | RW |")
    const errors = sourceErrors(core)
    assert.ok(errors.some((e) => /"release-manager" has no row/.test(e)))
    assert.ok(errors.some((e) => /index row "release-boss" matches no agent or skill/.test(e)))
})

test("source: a kit agent without an explicit model is an error", () => {
    const core = coreCopy()
    edit(core, "agents/git-specialist.md", "model: sonnet\n", "")
    assert.ok(sourceErrors(core).some((e) => /git-specialist.*explicit `model`/.test(e)))
})

test("source: removing a skill that agents preload is caught (no whitelist hole)", () => {
    const core = coreCopy()
    rmSync(join(core, "skills", "conventions-guide"), { recursive: true })
    const errors = sourceErrors(core)
    assert.ok(errors.some((e) => /"conventions-guide" is not an installed skill/.test(e)))
    assert.ok(errors.some((e) => /index row "conventions-guide" matches no agent or skill/.test(e)))
})

test("target: clean install has no errors; only baseline TBD warnings", () => {
    const issues = targetIssues(installed())
    assert.deepEqual(issues.filter((i) => i.startsWith("error")), [])
    assert.ok(issues.every((i) => /not filled in yet/.test(i)), issues.join("\n"))
})

test("target: reports drift, missing managed files and a broken CLAUDE.md block", () => {
    const t = installed()
    append(t, ".soul/agents.md", "\nhand edit\n")
    rmSync(join(t, ".claude/agents/security-specialist.md"))
    write(t, "CLAUDE.md", "# no block\n")
    const issues = targetIssues(t)
    assert.ok(issues.some((i) => /warning \.soul\/agents\.md: edited locally/.test(i)))
    assert.ok(issues.some((i) => /error .*security-specialist\.md: managed file is missing/.test(i)))
    assert.ok(issues.some((i) => /error CLAUDE\.md: no agentsoul managed block/.test(i)))
})

test("target: a new local rules file must be imported", () => {
    const t = installed()
    write(t, ".soul/local/team.md", "rule\n")
    assert.ok(targetIssues(t).some((i) => /@\.soul\/local\/team\.md is not imported/.test(i)))
})

test("target: the project's own agents are not judged", () => {
    const t = installed()
    write(t, ".claude/agents/my-helper.md", "no frontmatter at all\n")
    assert.ok(!targetIssues(t).some((i) => i.includes("my-helper")))
})

test("target: no manifest → tells 0.1 installs and empty dirs apart", () => {
    const empty = tempDir()
    assert.match(targetIssues(empty)[0], /not installed here/)
    write(empty, ".soul/identity.md", "x")
    assert.match(targetIssues(empty)[0], /installed by AgentSoul 0\.1/)
})
