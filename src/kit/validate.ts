import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { BASELINE_IMPORTS, blockImports, CLAUDE_MD_PATH, hasBlock } from "./claude-md.js"
import { defaultConfig, isValidModel, readConfig } from "./config.js"
import { parseFrontmatter } from "./frontmatter.js"
import { NEW_SUFFIX, listLocalRules } from "./install.js"
import { DEFAULT_PROFILE, renderAgent, renderManaged, renderSeed, type FileMap, type Kit } from "./kit.js"
import { MANIFEST_PATH, readManifest, sha256 } from "./manifest.js"

export interface Issue {
    readonly level: "error" | "warning"
    readonly where: string
    readonly message: string
}

const KNOWN_TOOLS = new Set([
    "Read", "Write", "Edit", "MultiEdit", "Grep", "Glob", "Bash", "WebFetch", "WebSearch",
    "NotebookEdit", "TodoWrite", "Agent", "Task", "Skill", "AskUserQuestion",
])
const AGENT = /^\.claude\/agents\/([^/]+)\.md$/
const SKILL = /^\.claude\/skills\/([^/]+)\/SKILL\.md$/
const INDEX = ".soul/agents.md"
const TBD = /\bTBD\b|ещё не заполнен/

/**
 * Validates the kit sources in `core/` (used by AgentSoul's own CI): every
 * profile renders, and the rendered set is internally consistent.
 */
export function validateSource(kit: Kit): Issue[] {
    const issues: Issue[] = []
    if (!kit.profiles.has(DEFAULT_PROFILE)) {
        issues.push(error("core/profiles", `default profile "${DEFAULT_PROFILE}" is missing`))
    }
    for (const required of ["config.json", "glossary.md", "local/rules.md"]) {
        if (!kit.seed.has(required)) issues.push(error("core/seed", `missing ${required}`))
    }
    for (const profile of kit.profiles.values()) {
        if (!profile.stack.startsWith("## Tech Stack")) {
            issues.push(error(`core/profiles/${profile.name}/stack.md`, "must start with `## Tech Stack`"))
        }
        renderSeed(kit, profile.name)
    }
    for (const [name, source] of kit.agents) {
        const model = safeData(source)?.["model"]
        if (typeof model !== "string") {
            issues.push(error(`core/agents/${name}.md`, "kit agents must declare an explicit `model`"))
        }
    }
    const managed = renderManaged(kit, defaultConfig(DEFAULT_PROFILE))
    issues.push(...checkContent(managed, [...managed.keys()]))
    return issues
}

/**
 * Validates an installed project strictly against its manifest: only files
 * AgentSoul installed are judged, so the project's own agents and skills are
 * never reported.
 */
export function validateTarget(target: string, kit: Kit, version: string): Issue[] {
    const issues: Issue[] = []
    const manifest = readManifest(target)
    if (manifest === null) {
        const legacy = existsSync(join(target, ".soul"))
        return [
            error(
                MANIFEST_PATH,
                legacy
                    ? "installed by AgentSoul 0.1 (no manifest) — run `agentsoul update --dry-run`, then `agentsoul update`"
                    : "AgentSoul is not installed here — run `agentsoul init`",
            ),
        ]
    }
    if (compareVersions(manifest.version, version) < 0) {
        issues.push(warning(MANIFEST_PATH, `installed ${manifest.version}, available ${version} — run \`agentsoul update\``))
    }

    let config = defaultConfig(manifest.profile)
    try {
        config = readConfig(target) ?? config
    } catch (err) {
        issues.push(error(".soul/config.json", (err as Error).message))
    }

    const managedPaths = Object.keys(manifest.files)
    const files: FileMap = new Map()
    for (const path of managedPaths) {
        const abs = join(target, path)
        if (!existsSync(abs)) {
            issues.push(error(path, "managed file is missing — run `agentsoul update` to restore it"))
            continue
        }
        const content = readFileSync(abs, "utf8")
        files.set(path, content)
        if (existsSync(abs + NEW_SUFFIX)) {
            issues.push(warning(path, `unresolved update in ${path}${NEW_SUFFIX} — merge it, then \`agentsoul update --resolve ${path}\``))
        } else if (sha256(content) !== manifest.files[path]) {
            issues.push(warning(path, "edited locally (drift) — move project rules to .soul/local/ instead"))
        }
    }
    issues.push(...checkContent(files, managedPaths))

    for (const [name, model] of Object.entries(config.models.agents)) {
        if (!files.has(`.claude/agents/${name}.md`)) {
            issues.push(error(".soul/config.json", `models.agents.${name}: no such AgentSoul agent`))
        } else if (!isValidModel(model)) {
            issues.push(error(".soul/config.json", `models.agents.${name}: invalid model "${model}"`))
        }
    }
    for (const [name, source] of kit.agents) {
        const path = `.claude/agents/${name}.md`
        const installed = files.get(path)
        // A file awaiting conflict resolution is already reported; its model is part of that merge.
        if (installed === undefined || existsSync(join(target, path + NEW_SUFFIX))) continue
        const wanted = safeData(renderAgent(name, source, config))?.["model"]
        const actual = safeData(installed)?.["model"]
        if (wanted !== actual) {
            issues.push(warning(path, `model is "${String(actual)}", config wants "${String(wanted)}" — run \`agentsoul update\``))
        }
    }

    issues.push(...checkClaudeMd(target))
    for (const [path, label] of [[".soul/stack.md", "project-initializer"], [".soul/glossary.md", "glossary-initializer"]] as const) {
        const abs = join(target, path)
        if (!existsSync(abs)) issues.push(error(path, "baseline file is missing"))
        else if (TBD.test(readFileSync(abs, "utf8"))) issues.push(warning(path, `not filled in yet — run skill \`${label}\``))
    }
    return issues
}

/** Checks shared by both modes: agent/skill frontmatter, skill references, index, cross-references. */
function checkContent(files: FileMap, managedPaths: readonly string[]): Issue[] {
    const issues: Issue[] = []
    const agents = new Map<string, string>()
    const skills = new Map<string, string>()
    for (const path of managedPaths) {
        const content = files.get(path)
        if (content === undefined) continue
        const agent = AGENT.exec(path)?.[1]
        const skill = SKILL.exec(path)?.[1]
        if (agent !== undefined) agents.set(agent, content)
        if (skill !== undefined) skills.set(skill, content)
    }

    for (const [name, content] of skills) {
        const where = `.claude/skills/${name}/SKILL.md`
        const data = frontmatterOrIssue(content, where, issues)
        if (data === null) continue
        if (data["name"] !== name) issues.push(error(where, `name "${String(data["name"])}" != directory "${name}"`))
        if (typeof data["description"] !== "string" || data["description"].trim() === "") {
            issues.push(error(where, "missing `description`"))
        }
    }

    for (const [name, content] of agents) {
        const where = `.claude/agents/${name}.md`
        const data = frontmatterOrIssue(content, where, issues)
        if (data === null) continue
        if (data["name"] !== name) issues.push(error(where, `name "${String(data["name"])}" != filename "${name}"`))
        if (typeof data["description"] !== "string" || data["description"].trim() === "") {
            issues.push(error(where, "missing `description`"))
        }
        const tools = data["tools"]
        if (!Array.isArray(tools) || tools.length === 0) {
            issues.push(error(where, "`tools` must be a non-empty YAML list"))
        } else {
            for (const tool of tools) {
                if (typeof tool !== "string" || (!KNOWN_TOOLS.has(tool) && !tool.startsWith("mcp__"))) {
                    issues.push(error(where, `unknown tool "${String(tool)}"`))
                }
            }
        }
        const model = data["model"]
        if (model !== undefined && (typeof model !== "string" || !isValidModel(model))) {
            issues.push(error(where, `invalid model "${String(model)}"`))
        }
        const refs = data["skills"]
        if (refs !== undefined) {
            if (!Array.isArray(refs)) issues.push(error(where, "`skills` must be a YAML list"))
            else for (const ref of refs) {
                if (typeof ref !== "string" || !skills.has(ref)) {
                    issues.push(error(where, `skills: "${String(ref)}" is not an installed skill`))
                }
            }
        }
    }

    const index = files.get(INDEX)
    if (index === undefined) {
        issues.push(error(INDEX, "index is missing"))
    } else {
        const rows = new Set([...index.matchAll(/^\| `([a-z][a-z0-9-]*)` \|/gm)].map((m) => m[1] ?? ""))
        for (const name of [...agents.keys(), ...skills.keys()]) {
            if (!rows.has(name)) issues.push(error(INDEX, `"${name}" has no row in the index tables`))
        }
        for (const row of rows) {
            if (!agents.has(row) && !skills.has(row)) issues.push(error(INDEX, `index row "${row}" matches no agent or skill`))
        }
    }

    const known = new Set([...agents.keys(), ...skills.keys()])
    const role = /`([a-z][a-z0-9-]*-(?:architect|specialist|expert|designer|keeper|initializer|manager|planner|guide|reference|reviewer|optimizer))`/g
    for (const path of managedPaths) {
        const content = files.get(path)
        if (content === undefined || !path.endsWith(".md")) continue
        for (const m of content.matchAll(role)) {
            const ref = m[1] ?? ""
            if (!known.has(ref)) issues.push(warning(path, `mentions \`${ref}\`, which is neither an agent nor a skill`))
        }
    }
    return dedupe(issues)
}

function checkClaudeMd(target: string): Issue[] {
    const abs = join(target, CLAUDE_MD_PATH)
    if (!existsSync(abs)) return [error(CLAUDE_MD_PATH, "missing — run `agentsoul update` to recreate it")]
    const content = readFileSync(abs, "utf8")
    if (!hasBlock(content)) return [error(CLAUDE_MD_PATH, "no agentsoul managed block — run `agentsoul update`")]
    const issues: Issue[] = []
    const imports = blockImports(content)
    for (const path of imports) {
        if (!existsSync(join(target, path))) issues.push(error(CLAUDE_MD_PATH, `imports @${path}, which does not exist`))
    }
    for (const path of [...BASELINE_IMPORTS, ...listLocalRules(target)]) {
        if (!imports.includes(path)) issues.push(warning(CLAUDE_MD_PATH, `@${path} is not imported — run \`agentsoul update\``))
    }
    return issues
}

function frontmatterOrIssue(content: string, where: string, issues: Issue[]): Record<string, unknown> | null {
    try {
        return parseFrontmatter(content).data
    } catch (err) {
        issues.push(error(where, (err as Error).message))
        return null
    }
}

function safeData(content: string): Record<string, unknown> | null {
    try {
        return parseFrontmatter(content).data
    } catch {
        // Reported separately by checkContent; here only the model value matters.
        return null
    }
}

/** Semver-ish numeric comparison of `x.y.z`; pre-release tags are ignored. */
export function compareVersions(a: string, b: string): number {
    const pa = a.split(/[.-]/).map((p) => Number.parseInt(p, 10) || 0)
    const pb = b.split(/[.-]/).map((p) => Number.parseInt(p, 10) || 0)
    for (let i = 0; i < 3; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
        if (diff !== 0) return diff
    }
    return 0
}

function dedupe(issues: Issue[]): Issue[] {
    const seen = new Set<string>()
    return issues.filter((i) => {
        const key = `${i.level}|${i.where}|${i.message}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

const error = (where: string, message: string): Issue => ({ level: "error", where, message })
const warning = (where: string, message: string): Issue => ({ level: "warning", where, message })
