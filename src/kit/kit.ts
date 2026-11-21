import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { parseFrontmatter, setFrontmatterLine } from "./frontmatter.js"
import type { SoulConfig } from "./config.js"

/** Project-relative path → file contents. */
export type FileMap = Map<string, string>

/**
 * The kit as shipped in `core/`:
 *   soul/              → .soul/            (managed)
 *   skills/<name>/**   → .claude/skills/   (managed)
 *   agents/<name>.md   → .claude/agents/   (managed, `model` rendered from config)
 *   seed/**            → .soul/            (project-owned, written once)
 *   profiles/<name>/   → stack.md seed + description
 */
export interface Kit {
    readonly dir: string
    readonly soul: FileMap
    readonly skills: ReadonlyMap<string, FileMap>
    readonly agents: ReadonlyMap<string, string>
    readonly seed: FileMap
    readonly profiles: ReadonlyMap<string, Profile>
    /** Hashes of files shipped by AgentSoul 0.1.x, keyed by project path (`core/legacy/0.1.json`). */
    readonly legacy: ReadonlyMap<string, ReadonlySet<string>>
}

export interface Profile {
    readonly name: string
    readonly description: string
    readonly stack: string
}

export const DEFAULT_PROFILE = "blank"

/** Loads the kit from a core directory. Pure read — never writes. */
export function loadKit(coreDir: string): Kit {
    const soul = readTree(join(coreDir, "soul"))
    const seed = readTree(join(coreDir, "seed"))

    const skills = new Map<string, FileMap>()
    for (const name of listDirs(join(coreDir, "skills"))) {
        skills.set(name, readTree(join(coreDir, "skills", name)))
    }

    const agents = new Map<string, string>()
    for (const file of readdirSync(join(coreDir, "agents")).sort()) {
        if (!file.endsWith(".md")) continue
        agents.set(file.slice(0, -3), readFileSync(join(coreDir, "agents", file), "utf8"))
    }

    const profiles = new Map<string, Profile>()
    for (const name of listDirs(join(coreDir, "profiles"))) {
        const dir = join(coreDir, "profiles", name)
        const meta: unknown = JSON.parse(readFileSync(join(dir, "profile.json"), "utf8"))
        const description =
            meta !== null && typeof meta === "object" && "description" in meta && typeof meta.description === "string"
                ? meta.description
                : name
        profiles.set(name, { name, description, stack: readFileSync(join(dir, "stack.md"), "utf8") })
    }

    return { dir: coreDir, soul, skills, agents, seed, profiles, legacy: readLegacy(join(coreDir, "legacy", "0.1.json")) }
}

function readLegacy(path: string): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>()
    if (!existsSync(path)) return out
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"))
    const files = raw !== null && typeof raw === "object" && "files" in raw ? raw.files : null
    if (files === null || typeof files !== "object") throw new Error(`${path}: expected { files: { path: [sha256] } }`)
    for (const [p, hashes] of Object.entries(files)) {
        if (Array.isArray(hashes)) out.set(p, new Set(hashes.filter((h): h is string => typeof h === "string")))
    }
    return out
}

/**
 * Files AgentSoul owns in a target project, rendered for the given config.
 * These are tracked in the manifest and replaced by `update` when unmodified.
 */
export function renderManaged(kit: Kit, config: SoulConfig): FileMap {
    const out: FileMap = new Map()
    for (const [path, content] of kit.soul) out.set(`.soul/${path}`, content)
    for (const [name, files] of kit.skills) {
        for (const [path, content] of files) out.set(`.claude/skills/${name}/${path}`, content)
    }
    for (const [name, source] of kit.agents) {
        out.set(`.claude/agents/${name}.md`, renderAgent(name, source, config))
    }
    return out
}

/** Applies the project's model choice to one agent definition. */
export function renderAgent(name: string, source: string, config: SoulConfig): string {
    const override = config.models.agents[name] ?? config.models.default
    return override === null ? source : setFrontmatterLine(source, "model", override)
}

/**
 * Files the project owns after installation: written only when missing, never overwritten.
 *
 * @throws Error for an unknown profile name.
 */
export function renderSeed(kit: Kit, profileName: string): FileMap {
    const profile = kit.profiles.get(profileName)
    if (profile === undefined) {
        throw new Error(`unknown profile "${profileName}". Available: ${[...kit.profiles.keys()].join(", ")}`)
    }
    const out: FileMap = new Map()
    out.set(".soul/stack.md", profile.stack)
    for (const [path, content] of kit.seed) {
        out.set(`.soul/${path}`, content.replaceAll("{{profile}}", profileName))
    }
    return out
}

/** Names of agents and skills declared by an agent's `skills:` frontmatter. */
export function agentSkills(source: string): string[] {
    const skills = parseFrontmatter(source).data["skills"]
    return Array.isArray(skills) ? skills.filter((s): s is string => typeof s === "string") : []
}

function readTree(root: string): FileMap {
    const out: FileMap = new Map()
    if (!existsSync(root)) return out
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir).sort()) {
            if (entry.startsWith("._") || entry === ".DS_Store") continue
            const path = join(dir, entry)
            if (statSync(path).isDirectory()) walk(path)
            else out.set(relative(root, path).split("\\").join("/"), readFileSync(path, "utf8"))
        }
    }
    walk(root)
    return out
}

function listDirs(root: string): string[] {
    if (!existsSync(root)) return []
    return readdirSync(root)
        .filter((e) => !e.startsWith(".") && statSync(join(root, e)).isDirectory())
        .sort()
}
