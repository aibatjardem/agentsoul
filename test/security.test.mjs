import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdirSync, rmSync, symlinkSync, writeFileSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { applyPlan, planInstall } from "../dist/kit/install.js"
import { loadKit } from "../dist/kit/kit.js"
import { isManagedPath, sha256 } from "../dist/kit/manifest.js"
import { CORE, tempDir, write } from "./helpers.mjs"

const install = (target) => applyPlan(planInstall({ kit: loadKit(CORE), target, version: "9.9.9", force: false }), target)

test("manifest: a key escaping the project is rejected, the outside file survives", () => {
    const outside = tempDir("agentsoul-victim-")
    const victim = join(outside, "precious.txt")
    writeFileSync(victim, "keep me\n")
    const t = tempDir()
    install(t)
    const rel = join("..", outside.split("/").pop(), "precious.txt")
    const manifest = JSON.parse(readFileSync(join(t, ".soul/.agentsoul.json"), "utf8"))
    manifest.files[`.soul/../../${rel}`] = sha256("keep me\n")
    manifest.files[rel] = sha256("keep me\n")
    write(t, ".soul/.agentsoul.json", JSON.stringify(manifest))

    assert.throws(() => install(t), /refusing path/)
    assert.equal(readFileSync(victim, "utf8"), "keep me\n")
})

test("isManagedPath: only plain relative paths in managed namespaces", () => {
    for (const ok of [".soul/identity.md", ".claude/agents/x.md", ".claude/skills/a/SKILL.md", "scripts/check-soul.sh"]) {
        assert.ok(isManagedPath(ok), ok)
    }
    for (const bad of ["../x", ".soul/../../x", "/etc/passwd", ".claude/agents/../../x", "src/index.ts", ".soul//x", ".soul\\x", ".soul/./x"]) {
        assert.ok(!isManagedPath(bad), bad)
    }
})

test("symlinked .claude/agents pointing outside: install refuses to write through it", () => {
    const outside = tempDir("agentsoul-victim-")
    const t = tempDir()
    mkdirSync(join(t, ".claude"), { recursive: true })
    symlinkSync(outside, join(t, ".claude", "agents"))
    assert.throws(() => install(t), /symlink/)
    assert.ok(!existsSync(join(outside, "code-reviewer.md")))
})

test("symlinked managed file: update refuses instead of overwriting the link target", () => {
    const outside = tempDir("agentsoul-victim-")
    const victim = join(outside, "target.md")
    writeFileSync(victim, "outside\n")
    const t = tempDir()
    install(t)
    const path = join(t, ".soul", "README.md")
    rmSync(path)
    symlinkSync(victim, path)
    assert.throws(() => install(t), /symlink/)
    assert.equal(readFileSync(victim, "utf8"), "outside\n")
})
