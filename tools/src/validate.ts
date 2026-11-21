import { readFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { buildLocale, listLocales, pluginName, type FileMap } from "./build.js"
import { parseFrontmatter } from "./frontmatter.js"
import { packageVersion } from "./paths.js"

export interface Issue {
    readonly level: "error" | "warning"
    readonly where: string
    readonly message: string
}

/** Compact soul injected by the hook; the whole hook output must stay under 9 000. */
export const CORE_BUDGET = 6500

const AGENT_FIELDS = new Set(["name", "description", "tools", "model", "skills"])
const KNOWN_TOOLS = new Set([
    "Read", "Write", "Edit", "MultiEdit", "Grep", "Glob", "Bash", "WebFetch", "WebSearch",
    "NotebookEdit", "TodoWrite", "Agent", "Task", "Skill", "AskUserQuestion",
])
const CYRILLIC = /[А-Яа-яЁё]/
/** Phrases from the npm era (0.1/0.2) that must not survive in plugin texts. */
const STALE = [/npx agentsoul/, /agentsoul (init|update|check)\b/, /\.agentsoul-new/, /core\/(soul|agents|skills)\//]

export function isValidModel(value: string): boolean {
    return /^(inherit|opus|sonnet|haiku|fable)$/.test(value) || /^claude-[a-z0-9.-]+$/.test(value)
}

/** Validates every locale under src/locales/ by building it in memory and checking the result. */
export function validateSources(root: string): Issue[] {
    const issues: Issue[] = []
    const version = packageVersion(root)
    const locales = listLocales(root)
    if (locales.length === 0) return [error("src/locales", "no locales found")]

    const shapes = new Map<string, string>()
    for (const locale of locales) {
        let built: FileMap
        try {
            built = buildLocale(root, locale, version)
        } catch (err) {
            issues.push(error(`src/locales/${locale}`, `build failed: ${(err as Error).message}`))
            continue
        }
        issues.push(...validateLocale(root, locale, built))
        shapes.set(locale, shapeOf(built))
    }

    const [first, ...rest] = [...shapes.entries()]
    if (first !== undefined) {
        for (const [locale, shape] of rest) {
            if (shape !== first[1]) {
                issues.push(error(`src/locales/${locale}`, `agents/skills/profiles/templates differ from locale "${first[0]}"`))
            }
        }
    }

    for (const script of ["src/shared/hooks/session-start", ...locales.map((l) => `src/locales/${l}/soul/messages.sh`)]) {
        const res = spawnSync("bash", ["-n", join(root, script)], { encoding: "utf8" })
        if (res.status !== 0) issues.push(error(script, `bash syntax error: ${res.stderr.trim()}`))
    }
    return issues
}

function validateLocale(root: string, locale: string, built: FileMap): Issue[] {
    const issues: Issue[] = []
    const plugin = pluginName(locale)
    const base = `src/locales/${locale}`
    const agents = new Map<string, string>()
    const skills = new Map<string, string>()
    for (const [path, content] of built) {
        const a = /^agents\/([^/]+)\.md$/.exec(path)?.[1]
        const s = /^skills\/([^/]+)\/SKILL\.md$/.exec(path)?.[1]
        if (a !== undefined) agents.set(a, content)
        if (s !== undefined) skills.set(s, content)
    }

    for (const [name, content] of skills) {
        const where = `${base}/skills/${name}/SKILL.md`
        const data = frontmatter(content, where, issues)
        if (data === null) continue
        if (data["name"] !== name) issues.push(error(where, `name "${String(data["name"])}" != directory "${name}"`))
        checkDescription(data["description"], where, issues)
    }

    for (const [name, content] of agents) {
        const where = `${base}/agents/${name}.md`
        const data = frontmatter(content, where, issues)
        if (data === null) continue
        for (const key of Object.keys(data)) {
            if (!AGENT_FIELDS.has(key)) issues.push(error(where, `field "${key}" is not allowed (plugin agents ignore or must not use it)`))
        }
        if (data["name"] !== name) issues.push(error(where, `name "${String(data["name"])}" != filename "${name}"`))
        checkDescription(data["description"], where, issues)
        const tools = data["tools"]
        if (!Array.isArray(tools) || tools.length === 0) {
            issues.push(error(where, "`tools` must be a non-empty YAML list"))
        } else {
            for (const t of tools) {
                if (typeof t !== "string" || !KNOWN_TOOLS.has(t)) issues.push(error(where, `unknown tool "${String(t)}"`))
            }
            if (!tools.includes("Skill")) issues.push(error(where, "`tools` must include Skill (agents load language packs themselves)"))
        }
        const model = data["model"]
        if (typeof model !== "string" || !isValidModel(model)) issues.push(error(where, `invalid model "${String(model)}"`))
        const refs = data["skills"]
        if (refs !== undefined) {
            if (!Array.isArray(refs)) issues.push(error(where, "`skills` must be a YAML list"))
            else for (const ref of refs) {
                const m = typeof ref === "string" ? new RegExp(`^${plugin}:(.+)$`).exec(ref) : null
                if (m === null) issues.push(error(where, `skills: "${String(ref)}" must be written as ${plugin}:<skill>`))
                else if (!skills.has(m[1] ?? "")) issues.push(error(where, `skills: "${String(ref)}" is not a skill of this plugin`))
            }
        }
    }

    const known = new Set([...agents.keys(), ...skills.keys()])
    const refPattern = new RegExp(`${plugin}:([a-z0-9][a-z0-9-]*)`, "g")
    for (const [path, content] of built) {
        if (/\{\{[^}]*\}\}/.test(content)) issues.push(error(`${plugin}/${path}`, "unresolved {{…}} placeholder"))
        if (!/\.(md|sh)$/.test(path)) continue
        for (const m of content.matchAll(refPattern)) {
            const ref = m[1] ?? ""
            // `lang-<язык>` is a pattern in prose, not a reference to one skill.
            if (ref.endsWith("-")) continue
            if (!known.has(ref)) issues.push(error(`${plugin}/${path}`, `mentions ${plugin}:${ref}, which is neither an agent nor a skill`))
        }
        for (const stale of STALE) {
            if (stale.test(content)) issues.push(error(`${plugin}/${path}`, `mentions the npm-era "${stale.source}" — plugins are installed with /plugin`))
        }
    }

    const index = readFileSync(join(root, base, "soul", "agents.md"), "utf8").replaceAll("{{plugin}}", plugin)
    const rows = new Set([...index.matchAll(new RegExp(`^\\| \`${plugin}:([a-z0-9-]+)\` \\|`, "gm"))].map((m) => m[1] ?? ""))
    for (const name of known) {
        if (!rows.has(name)) issues.push(error(`${base}/soul/agents.md`, `"${name}" has no row in the map`))
    }
    for (const row of rows) {
        if (!known.has(row)) issues.push(error(`${base}/soul/agents.md`, `map row "${row}" matches no agent or skill`))
    }

    const core = built.get("hooks/soul-core.md") ?? ""
    if ([...core].length > CORE_BUDGET) {
        issues.push(error(`${base}/soul/core.md`, `${[...core].length} characters, budget is ${CORE_BUDGET}`))
    }

    const label = /^MSG_LANG_LABEL="([^"]+)"/m.exec(built.get("hooks/messages.sh") ?? "")?.[1]
    if (label === undefined) issues.push(error(`${base}/soul/messages.sh`, "MSG_LANG_LABEL is not set"))
    for (const [path, content] of built) {
        if (!/^skills\/setup\/profiles\/[^/]+\/stack\.md$/.test(path)) continue
        if (!content.startsWith("## Tech Stack")) issues.push(error(`${plugin}/${path}`, "must start with `## Tech Stack`"))
        if (label !== undefined && !content.includes(`**${label}:**`)) {
            issues.push(error(`${plugin}/${path}`, `has no "**${label}:**" line — the hook reads project languages from it`))
        }
    }
    return issues
}

/** Locale-independent outline of a build, for parity between locales. */
function shapeOf(built: FileMap): string {
    return [...built.keys()]
        .filter((p) => /^(agents\/|skills\/[^/]+\/SKILL\.md$|skills\/setup\/(profiles|templates)\/)/.test(p))
        .sort()
        .join("\n")
}

function checkDescription(value: unknown, where: string, issues: Issue[]): void {
    if (typeof value !== "string" || value.trim() === "") issues.push(error(where, "missing `description`"))
    else if (CYRILLIC.test(value)) issues.push(error(where, "`description` must be in English (Claude matches it to pick the agent)"))
}

function frontmatter(content: string, where: string, issues: Issue[]): Record<string, unknown> | null {
    try {
        return parseFrontmatter(content).data
    } catch (err) {
        issues.push(error(where, (err as Error).message))
        return null
    }
}

const error = (where: string, message: string): Issue => ({ level: "error", where, message })
