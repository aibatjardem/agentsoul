import { test } from "node:test"
import assert from "node:assert/strict"
import { blockImports, upsertBlock } from "../dist/kit/claude-md.js"
import { setFrontmatterLine } from "../dist/kit/frontmatter.js"

test("CLAUDE.md: block is prepended; user content is preserved", () => {
    const out = upsertBlock("# Team rules\n\nUse pnpm.\n", [])
    assert.match(out, /^<!-- agentsoul:begin/)
    assert.match(out, /# Team rules\n\nUse pnpm\.\n$/)
})

test("CLAUDE.md: refreshing is idempotent and keeps text around the block", () => {
    const once = upsertBlock("above?\n", [".soul/local/rules.md"])
    const withTail = `${once}\n## Mine\n`
    const twice = upsertBlock(withTail, [".soul/local/rules.md"])
    assert.equal(twice, withTail)
    assert.equal((twice.match(/agentsoul:begin/g) ?? []).length, 1)
})

test("CLAUDE.md: local rules are imported after the baseline (they win)", () => {
    const imports = blockImports(upsertBlock(null, [".soul/local/b.md", ".soul/local/a.md"]))
    assert.deepEqual(imports.slice(-2), [".soul/local/a.md", ".soul/local/b.md"])
    assert.equal(imports[0], ".soul/identity.md")
})

test("CLAUDE.md: AgentSoul 0.1 imports and bootstrap are migrated, not duplicated", () => {
    const legacy = [
        "- @.soul/identity.md",
        "- @.soul/agents.md",
        "",
        "## ⚠ Session bootstrap — прочитать ПЕРВЫМ",
        "",
        "old rule",
        "",
        "---",
        "",
        "Полный индекс субагентов и правила вызова — в `.soul/agents.md`.",
        "",
        "# My notes",
        "",
    ].join("\n")
    const out = upsertBlock(legacy, [])
    assert.equal((out.match(/- @\.soul\/identity\.md/g) ?? []).length, 1)
    assert.doesNotMatch(out, /old rule|Полный индекс/)
    assert.match(out, /# My notes/)
})

test("frontmatter: setting one line leaves every other byte untouched", () => {
    const src = '---\nname: x\ndescription: "Quoted: keeps quotes"\ntools: [Read, Grep]\nmodel: opus\n---\nbody\n'
    assert.equal(setFrontmatterLine(src, "model", "fable"), src.replace("model: opus", "model: fable"))
    assert.equal(setFrontmatterLine(src, "skills", "[a]"), src.replace("model: opus\n", "model: opus\nskills: [a]\n"))
})
