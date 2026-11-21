import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdirSync, symlinkSync } from "node:fs"
import { join } from "node:path"
import { runHook, tempDir, write } from "./helpers.mjs"

const chars = (s) => [...s].length

test("hook: project without .soul → soul core + setup hint, valid JSON, exit 0", () => {
    const p = tempDir()
    const { status, json, context } = runHook({ projectDir: p })
    assert.equal(status, 0)
    assert.equal(json.hookSpecificOutput.hookEventName, "SessionStart")
    assert.match(context, /AgentSoul — душа/)
    assert.match(context, /\/agentsoul-ru:setup/)
    assert.ok(chars(context) <= 9000)
})

test("hook: .soul present → file paths and project languages", () => {
    const p = tempDir()
    write(p, ".soul/stack.md", "## Tech Stack\n\n### Базовое\n- **Языки:** Python, TypeScript\r\n- **Название:** bot\n")
    write(p, ".soul/glossary.md", "## Глоссарий\n")
    const { context } = runHook({ projectDir: p })
    assert.match(context, /- \.soul\/stack\.md/)
    assert.match(context, /- \.soul\/glossary\.md/)
    assert.match(context, /Языки проекта: Python, TypeScript\n/)
    assert.doesNotMatch(context, /\/agentsoul-ru:setup — это/)
})

test("hook: small local rules are inlined", () => {
    const p = tempDir()
    write(p, ".soul/stack.md", "## Tech Stack\n")
    write(p, ".soul/local/rules.md", "Всегда pnpm, никогда npm.")
    const { context } = runHook({ projectDir: p })
    assert.match(context, /### \.soul\/local\/rules\.md\nВсегда pnpm, никогда npm\./)
})

test("hook: oversized local rules → path + must-read note, context stays ≤ 9000", () => {
    const p = tempDir()
    write(p, ".soul/stack.md", "## Tech Stack\n")
    write(p, ".soul/local/huge.md", "правило ".repeat(2500))
    write(p, ".soul/local/small.md", "маленькое правило")
    const { context } = runHook({ projectDir: p })
    assert.ok(chars(context) <= 9000, `got ${chars(context)}`)
    assert.match(context, /\.soul\/local\/huge\.md — слишком большой.*ОБЯЗАТЕЛЬНО прочитай/)
    assert.match(context, /маленькое правило/)
})

test("hook: quotes, backslashes, tabs, CRLF and control chars keep JSON valid", () => {
    const p = tempDir()
    write(p, ".soul/stack.md", "## Tech Stack\n")
    write(p, ".soul/local/rules.md", 'путь "C:\\dev"\tтаб\r\nстрока\u0007звонок\u001b[0m')
    const { context } = runHook({ projectDir: p })
    assert.match(context, /путь "C:\\dev"\tтаб\nстрока/)
    assert.doesNotMatch(context, /[\u0000-\u0008\u000b-\u001f]/)
})

test("hook: no CLAUDE_PROJECT_DIR → uses the current directory", () => {
    const p = tempDir()
    write(p, ".soul/stack.md", "## Tech Stack\n- **Языки:** Go\n")
    const { context } = runHook({ cwd: p })
    assert.match(context, /Языки проекта: Go/)
})

test("hook: old 0.2 install → migration hint", () => {
    const p = tempDir()
    write(p, ".soul/.agentsoul.json", "{}")
    write(p, ".soul/stack.md", "## Tech Stack\n")
    const { context } = runHook({ projectDir: p })
    assert.match(context, /старая установка AgentSoul/)
})

test("hook: symlinks are never followed (no secrets from outside the project)", () => {
    const outside = tempDir("agentsoul-secret-")
    write(outside, "creds", "AWS_SECRET=leak-me-42")
    write(outside, "stack.md", "## Tech Stack\n- **Языки:** SECRET-LANG\n")
    mkdirSync(join(outside, "dir"), { recursive: true })
    write(outside, "dir/rules.md", "SECRET-DIR-RULE")

    const p1 = tempDir() // link as a rule file
    write(p1, ".soul/stack.md", "## Tech Stack\n")
    mkdirSync(join(p1, ".soul", "local"), { recursive: true })
    symlinkSync(join(outside, "creds"), join(p1, ".soul", "local", "env.md"))
    assert.doesNotMatch(runHook({ projectDir: p1 }).context, /leak-me-42/)

    const p2 = tempDir() // .soul/local itself is a link
    write(p2, ".soul/stack.md", "## Tech Stack\n")
    symlinkSync(join(outside, "dir"), join(p2, ".soul", "local"))
    assert.doesNotMatch(runHook({ projectDir: p2 }).context, /SECRET-DIR-RULE/)

    const p3 = tempDir() // stack.md is a link
    mkdirSync(join(p3, ".soul"), { recursive: true })
    symlinkSync(join(outside, "stack.md"), join(p3, ".soul", "stack.md"))
    assert.doesNotMatch(runHook({ projectDir: p3 }).context, /SECRET-LANG/)

    const p4 = tempDir() // .soul itself is a link → treated as not set up
    symlinkSync(outside, join(p4, ".soul"))
    const c4 = runHook({ projectDir: p4 }).context
    assert.doesNotMatch(c4, /SECRET/)
    assert.match(c4, /\/agentsoul-ru:setup/)
})

test("hook: no local rule disappears silently when the budget runs out", () => {
    const p = tempDir()
    write(p, ".soul/stack.md", "## Tech Stack\n")
    write(p, ".soul/local/api.md", "а".repeat(4960))
    write(p, ".soul/local/git.md", "б".repeat(240))
    write(p, ".soul/local/texts.md", "в".repeat(240))
    for (let i = 0; i < 40; i++) write(p, `.soul/local/z${String(i).padStart(2, "0")}.md`, "г".repeat(300))
    const { context } = runHook({ projectDir: p })
    assert.ok(chars(context) <= 9000, `got ${chars(context)}`)
    assert.match(context, /ОБЯЗАТЕЛЬНО прочитай все \*\.md в \.soul\/local\/ инструментом Read перед работой\.$/)
    // every pointer that is present is complete (path + must-read note)
    for (const line of context.split("\n").filter((l) => l.startsWith("- .soul/local/"))) {
        assert.match(line, /ОБЯЗАТЕЛЬНО прочитай его инструментом Read перед работой: \.soul\/local\/\S+\.md$/)
    }
})

test("hook: unreadable .soul file does not break the hook", () => {
    const p = tempDir()
    mkdirSync(join(p, ".soul", "local", "dir.md"), { recursive: true }) // a directory named like a rule file
    const { status, context } = runHook({ projectDir: p })
    assert.equal(status, 0)
    assert.match(context, /AgentSoul — душа/)
})
