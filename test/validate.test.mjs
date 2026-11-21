import { test } from "node:test"
import assert from "node:assert/strict"
import { cpSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { validateSources } from "../tools/dist/validate.js"
import { ROOT, repoCopy, write } from "./helpers.mjs"

const errors = (repo) => validateSources(repo).filter((i) => i.level === "error").map((i) => `${i.where}: ${i.message}`)
const edit = (repo, path, from, to) => {
    const abs = join(repo, path)
    const before = readFileSync(abs, "utf8")
    assert.ok(before.includes(from), `fixture: "${from}" not in ${path}`)
    write(repo, path, before.replace(from, to))
}
const A = "src/locales/ru/agents"

test("validate: the shipped sources are clean", () => {
    assert.deepEqual(errors(ROOT), [])
})

test("validate: forbidden frontmatter field, bad model, missing Skill tool", () => {
    const r = repoCopy()
    edit(r, `${A}/task-planner.md`, "model: inherit", "model: gpt-5\nhooks: []")
    edit(r, `${A}/code-reviewer.md`, "tools: [Read, Grep, Glob, Bash, Skill]", "tools: [Read, Grep]")
    const e = errors(r)
    assert.ok(e.some((x) => /task-planner.*field "hooks" is not allowed/.test(x)), e.join("\n"))
    assert.ok(e.some((x) => /task-planner.*invalid model "gpt-5"/.test(x)))
    assert.ok(e.some((x) => /code-reviewer.*must include Skill/.test(x)))
})

test("validate: skills: must be prefixed and must exist", () => {
    const r = repoCopy()
    edit(r, `${A}/ddd-architect.md`, "skills: [{{plugin}}:architecture-guide]", "skills: [architecture-guide, {{plugin}}:ghost]")
    const e = errors(r)
    assert.ok(e.some((x) => /"architecture-guide" must be written as agentsoul-ru:<skill>/.test(x)), e.join("\n"))
    assert.ok(e.some((x) => /"agentsoul-ru:ghost" is not a skill/.test(x)))
})

test("validate: dangling reference in prose and unresolved placeholder", () => {
    const r = repoCopy()
    edit(r, `${A}/git-specialist.md`, "# ", "Спроси `{{plugin}}:merge-wizard`, {{plugn}}.\n\n# ")
    const e = errors(r)
    assert.ok(e.some((x) => /mentions agentsoul-ru:merge-wizard/.test(x)), e.join("\n"))
    assert.ok(e.some((x) => /unresolved \{\{…\}\} placeholder/.test(x)))
})

test("validate: map must list every agent and skill, nothing else", () => {
    const r = repoCopy()
    edit(r, "src/locales/ru/soul/agents.md", "| `{{plugin}}:release-manager` |", "| `{{plugin}}:release-boss` |")
    const e = errors(r)
    assert.ok(e.some((x) => /"release-manager" has no row/.test(x)))
    assert.ok(e.some((x) => /map row "release-boss" matches no agent or skill/.test(x)))
})

test("validate: Russian description, oversized soul core, npm-era wording", () => {
    const r = repoCopy()
    edit(r, `${A}/domain-expert.md`, 'description: "Use when', 'description: "Используй когда')
    write(r, "src/locales/ru/soul/core.md", "ж".repeat(7000))
    edit(r, "src/locales/ru/skills/stack-reference/SKILL.md", "# ", "Запусти npx agentsoul update.\n\n# ")
    const e = errors(r)
    assert.ok(e.some((x) => /domain-expert.*must be in English/.test(x)), e.join("\n"))
    assert.ok(e.some((x) => /core\.md: 7000 characters, budget is 6500/.test(x)))
    assert.ok(e.some((x) => /stack-reference.*npm-era/.test(x)))
})

test("validate: broken hook syntax and a profile without the languages line", () => {
    const r = repoCopy()
    write(r, "src/shared/hooks/session-start", "#!/usr/bin/env bash\nif then fi\n")
    edit(r, "src/locales/ru/profiles/blank/stack.md", "- **Языки:** TBD\n", "")
    const e = errors(r)
    assert.ok(e.some((x) => /session-start: bash syntax error/.test(x)), e.join("\n"))
    assert.ok(e.some((x) => /profiles\/blank\/stack\.md: has no "\*\*Языки:\*\*" line/.test(x)))
})

test("validate: a second locale must have the same agents, skills, profiles and templates", () => {
    const r = repoCopy()
    cpSync(join(r, "src/locales/ru"), join(r, "src/locales/en"), { recursive: true })
    rmSync(join(r, "src/locales/en/agents/git-specialist.md"))
    edit(r, "src/locales/en/soul/agents.md", "| `{{plugin}}:git-specialist` | RW | Сложные merge/rebase/conflict, стратегия ветвления |\n", "")
    const e = errors(r)
    assert.ok(e.some((x) => /src\/locales\/(en|ru): agents\/skills\/profiles\/templates differ/.test(x)), e.join("\n"))
})

test("validate: hook wiring — untranslated message and missing hook script", () => {
    const r = repoCopy()
    edit(r, "src/locales/ru/soul/messages.sh", 'MSG_MORE="', 'MSG_MORE_OLD="')
    edit(r, "src/shared/hooks/hooks.json", "run-hook.cmd", "run-hooks.cmd")
    const e = errors(r)
    assert.ok(e.some((x) => /messages\.sh: MSG_MORE is not translated/.test(x)), e.join("\n"))
    assert.ok(e.some((x) => /hooks\.json: references hooks\/run-hooks\.cmd/.test(x)))
})
