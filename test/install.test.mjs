import { test } from "node:test"
import assert from "node:assert/strict"
import { rmSync } from "node:fs"
import { join } from "node:path"
import { applyPlan, planInstall, NEW_SUFFIX } from "../dist/kit/install.js"
import { loadKit } from "../dist/kit/kit.js"
import { readManifest, sha256 } from "../dist/kit/manifest.js"
import { validateTarget } from "../dist/kit/validate.js"
import { CORE, append, coreCopy, exists, read, tempDir, write } from "./helpers.mjs"

const install = (target, coreDir = CORE, opts = {}) => {
    const plan = planInstall({ kit: loadKit(coreDir), target, version: "9.9.9", force: false, ...opts })
    applyPlan(plan, target)
    return plan
}
const actionOf = (plan, path) => plan.items.find((i) => i.path === path)?.action
const errorsOf = (target) => validateTarget(target, loadKit(CORE), "9.9.9").filter((i) => i.level === "error")

test("init: fresh project gets all layers, a manifest, and validates clean", () => {
    const t = tempDir()
    install(t, CORE, { profile: "node-api" })
    for (const p of [
        ".soul/identity.md", ".soul/agents.md", ".soul/stack.md", ".soul/glossary.md", ".soul/config.json",
        ".soul/local/rules.md", ".claude/skills/architecture-guide/SKILL.md", ".claude/agents/code-reviewer.md", "CLAUDE.md",
    ]) assert.ok(exists(t, p), p)
    assert.match(read(t, ".soul/stack.md"), /профилем `node-api`/)
    assert.equal(JSON.parse(read(t, ".soul/config.json")).profile, "node-api")
    assert.equal(readManifest(t).version, "9.9.9")
    assert.ok(!exists(t, ".claude/agents/architecture-guide.md"), "guides are skills now, not agents")
    assert.deepEqual(errorsOf(t), [])
})

test("update: unmodified file follows the kit; local edit is kept when the kit did not change it", () => {
    const t = tempDir()
    const core = coreCopy()
    install(t, core)
    append(t, ".soul/identity.md", "\nlocal tweak\n")
    append(core, "agents/ddd-architect.md", "\nkit v2 change\n")

    const plan = install(t, core)
    assert.equal(actionOf(plan, ".claude/agents/ddd-architect.md"), "update")
    assert.match(read(t, ".claude/agents/ddd-architect.md"), /kit v2 change/)
    assert.equal(actionOf(plan, ".soul/identity.md"), "keep-local")
    assert.match(read(t, ".soul/identity.md"), /local tweak/)
})

test("update: edit + kit change → conflict, never overwritten; --resolve accepts the merge", () => {
    const t = tempDir()
    const core = coreCopy()
    install(t, core)
    const path = ".claude/agents/code-reviewer.md"
    append(t, path, "\nours\n")
    append(core, "agents/code-reviewer.md", "\ntheirs\n")

    let plan = install(t, core)
    assert.equal(actionOf(plan, path), "conflict")
    assert.match(read(t, path), /ours/)
    assert.match(read(t, path + NEW_SUFFIX), /theirs/)

    plan = install(t, core) // still unresolved: must stay a conflict, not sneak into "update"
    assert.equal(actionOf(plan, path), "conflict")

    append(t, path, "\ntheirs merged\n")
    plan = install(t, core, { resolve: [path] })
    assert.equal(actionOf(plan, path), "resolve")
    assert.ok(!exists(t, path + NEW_SUFFIX))
    assert.match(read(t, path), /ours[\s\S]*theirs merged/)
    // after resolving, the next kit-unchanged update keeps the merged file
    assert.equal(actionOf(install(t, core), path), "keep-local")
})

test("update --force: replaces local edits but backs them up first", () => {
    const t = tempDir()
    const core = coreCopy()
    install(t, core)
    const path = ".claude/agents/task-planner.md"
    append(t, path, "\nmine\n")
    append(core, "agents/task-planner.md", "\nkit\n")
    const plan = planInstall({ kit: loadKit(core), target: t, version: "9.9.9", force: true })
    const { backupDir } = applyPlan(plan, t)
    assert.equal(actionOf(plan, path), "overwrite")
    assert.doesNotMatch(read(t, path), /mine/)
    assert.match(read(backupDir, path), /mine/)
})

test("update: project-owned files are never touched", () => {
    const t = tempDir()
    const core = coreCopy()
    install(t, core)
    write(t, ".soul/stack.md", "## Tech Stack\nours\n")
    write(t, ".soul/local/rules.md", "ours\n")
    write(core, "seed/local/rules.md", "kit changed the template\n")
    install(t, core)
    assert.equal(read(t, ".soul/stack.md"), "## Tech Stack\nours\n")
    assert.equal(read(t, ".soul/local/rules.md"), "ours\n")
})

test("update: a deleted local-rules template is not recreated; missing stack.md is", () => {
    const t = tempDir()
    install(t)
    rmSync(join(t, ".soul/local/rules.md"))
    rmSync(join(t, ".soul/stack.md"))
    install(t)
    assert.ok(!exists(t, ".soul/local/rules.md"))
    assert.ok(exists(t, ".soul/stack.md"))
    assert.doesNotMatch(read(t, "CLAUDE.md"), /local\/rules\.md/)
})

test("update: a file the kit dropped is removed if untouched, kept as orphan if edited", () => {
    const t = tempDir()
    const core = coreCopy()
    install(t, core)
    append(t, ".claude/agents/git-specialist.md", "\nedited\n")
    rmSync(join(core, "agents", "git-specialist.md"))
    rmSync(join(core, "agents", "release-manager.md"))
    // the index must not keep rows for dropped agents
    write(core, "soul/agents.md", read(core, "soul/agents.md").replace(/^\| `(git-specialist|release-manager)` .*\n/gm, ""))

    const plan = install(t, core)
    assert.equal(actionOf(plan, ".claude/agents/release-manager.md"), "remove")
    assert.ok(!exists(t, ".claude/agents/release-manager.md"))
    assert.equal(actionOf(plan, ".claude/agents/git-specialist.md"), "orphan")
    assert.ok(exists(t, ".claude/agents/git-specialist.md"))
    assert.ok(!(".claude/agents/git-specialist.md" in readManifest(t).files))
})

test("models: config.json drives the rendered `model:` line", () => {
    const t = tempDir()
    install(t)
    write(t, ".soul/config.json", JSON.stringify({ profile: "blank", models: { default: "fable", agents: { "git-specialist": "opus" } } }))
    install(t)
    assert.match(read(t, ".claude/agents/ddd-architect.md"), /^model: fable$/m)
    assert.match(read(t, ".claude/agents/git-specialist.md"), /^model: opus$/m)
    assert.deepEqual(errorsOf(t), [])
})

test("models: invalid config is rejected with a precise message", () => {
    const t = tempDir()
    install(t)
    write(t, ".soul/config.json", JSON.stringify({ profile: "blank", models: { default: "gpt-5" } }))
    assert.throws(() => install(t), /models\.default "gpt-5" is not a valid model/)
})

test("init: pre-existing project files with kit names are not overwritten", () => {
    const t = tempDir()
    write(t, ".claude/agents/code-reviewer.md", "---\nname: code-reviewer\ndescription: ours\ntools: [Read]\n---\n")
    const plan = install(t)
    assert.equal(actionOf(plan, ".claude/agents/code-reviewer.md"), "conflict")
    assert.match(read(t, ".claude/agents/code-reviewer.md"), /description: ours/)
})

test("legacy 0.1: untouched files (hash in the 0.1 table) update cleanly, edited ones conflict", () => {
    const t = tempDir()
    write(t, ".soul/identity.md", "old identity from 0.1\n")
    write(t, ".claude/agents/ddd-architect.md", "old ddd from 0.1\n")
    write(t, ".claude/agents/architecture-guide.md", "old guide agent from 0.1\n")
    write(t, ".claude/agents/domain-expert.md", "edited by the user\n")
    const kit = loadKit(CORE)
    const legacy = new Map([
        [".soul/identity.md", new Set([sha256("old identity from 0.1\n")])],
        [".claude/agents/ddd-architect.md", new Set([sha256("old ddd from 0.1\n")])],
        [".claude/agents/architecture-guide.md", new Set([sha256("old guide agent from 0.1\n")])],
        [".claude/agents/domain-expert.md", new Set([sha256("original 0.1 text\n")])],
    ])
    const plan = planInstall({ kit: { ...kit, legacy }, target: t, version: "9.9.9", force: false })
    assert.ok(plan.legacy)
    assert.equal(actionOf(plan, ".soul/identity.md"), "update")
    assert.equal(actionOf(plan, ".claude/agents/ddd-architect.md"), "update")
    assert.equal(actionOf(plan, ".claude/agents/architecture-guide.md"), "remove")
    assert.equal(actionOf(plan, ".claude/agents/domain-expert.md"), "conflict")
})

test("legacy 0.1: the shipped hash table covers the files 0.1 installed", () => {
    const kit = loadKit(CORE)
    for (const p of [".soul/identity.md", ".claude/agents/architecture-guide.md", ".claude/agents/soul-keeper.md", "scripts/check-soul.sh"]) {
        assert.ok(kit.legacy.get(p)?.size > 0, p)
    }
})
