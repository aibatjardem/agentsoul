import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { packageVersion } from "./paths.js"

/** Path → contents. For a locale build the paths are relative to the plugin root; for `buildAll`, to the repo root. */
export type FileMap = Map<string, string>

export const MARKETPLACE = "agentsoul"
export const MARKETPLACE_PATH = ".claude-plugin/marketplace.json"
export const PLACEHOLDER = "{{plugin}}"
const OWNER = "aibatjardem"
const REPO_URL = "https://github.com/aibatjardem/agentsoul"

/** Files that must be executable in the built plugin. */
export const EXECUTABLE = new Set(["hooks/session-start", "hooks/run-hook.cmd"])

export const pluginName = (locale: string): string => `agentsoul-${locale}`

/** Locales present in src/locales/, sorted. */
export function listLocales(root: string): string[] {
    const dir = join(root, "src", "locales")
    return readdirSync(dir)
        .filter((e) => !e.startsWith(".") && statSync(join(dir, e)).isDirectory())
        .sort()
}

/**
 * Renders one locale into a plugin tree:
 *   .claude-plugin/plugin.json          name, version, description (from src/locales/<l>/plugin.json)
 *   agents/<name>.md                    from agents/
 *   skills/<name>/**                    from skills/
 *   skills/soul/SKILL.md                generated: full identity.md + agents.md
 *   skills/setup/{templates,profiles}/  project templates and stack profiles the setup skill copies
 *   hooks/*                             shared hook scripts + soul-core.md + messages.sh of the locale
 * `{{plugin}}` is replaced with the plugin name in every file.
 */
export function buildLocale(root: string, locale: string, version: string): FileMap {
    const src = join(root, "src", "locales", locale)
    const name = pluginName(locale)
    const out: FileMap = new Map()

    const meta = readJson(join(src, "plugin.json"))
    const description = stringField(meta, "description", `${locale}/plugin.json`)
    const keywords = Array.isArray(meta["keywords"]) ? meta["keywords"] : []
    out.set(
        ".claude-plugin/plugin.json",
        json({
            name,
            description,
            version,
            author: { name: OWNER },
            homepage: REPO_URL,
            repository: REPO_URL,
            license: "MIT",
            keywords,
        }),
    )

    for (const [path, content] of readTree(join(src, "agents"))) out.set(`agents/${path}`, content)
    for (const [path, content] of readTree(join(src, "skills"))) out.set(`skills/${path}`, content)
    for (const [path, content] of readTree(join(src, "templates"))) out.set(`skills/setup/templates/${path}`, content)
    for (const [path, content] of readTree(join(src, "profiles"))) out.set(`skills/setup/profiles/${path}`, content)

    out.set("skills/soul/SKILL.md", renderSoulSkill(src))
    out.set("hooks/soul-core.md", readFileSync(join(src, "soul", "core.md"), "utf8"))
    out.set("hooks/messages.sh", readFileSync(join(src, "soul", "messages.sh"), "utf8"))
    for (const [path, content] of readTree(join(root, "src", "shared", "hooks"))) out.set(`hooks/${path}`, content)
    out.set("LICENSE", readFileSync(join(root, "LICENSE"), "utf8"))

    for (const [path, content] of out) out.set(path, content.replaceAll(PLACEHOLDER, name))
    return out
}

/** Every plugin plus the marketplace manifest, keyed by repo-relative path. */
export function buildAll(root: string): FileMap {
    const version = packageVersion(root)
    const out: FileMap = new Map()
    const plugins: Record<string, unknown>[] = []
    for (const locale of listLocales(root)) {
        const name = pluginName(locale)
        const files = buildLocale(root, locale, version)
        for (const [path, content] of files) out.set(`plugins/${name}/${path}`, content)
        const manifest = readJson(join(root, "src", "locales", locale, "plugin.json"))
        plugins.push({
            name,
            source: `./plugins/${name}`,
            description: stringField(manifest, "description", `${locale}/plugin.json`),
            author: { name: OWNER },
            homepage: REPO_URL,
            license: "MIT",
        })
    }
    out.set(
        MARKETPLACE_PATH,
        json({
            name: MARKETPLACE,
            owner: { name: OWNER },
            metadata: { description: "AgentSoul — душа и команда специалистов для Claude Code" },
            plugins,
        }),
    )
    return out
}

/** Writes the build; removes stale files inside plugins/<name>/ that the build no longer produces. */
export function writeBuild(root: string, files: FileMap): void {
    for (const name of listLocales(root).map(pluginName)) {
        const dir = join(root, "plugins", name)
        for (const path of listFiles(dir)) {
            if (!files.has(`plugins/${name}/${path}`)) rmSync(join(dir, path))
        }
    }
    for (const [path, content] of files) {
        const abs = join(root, path)
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, content, "utf8")
        if (EXECUTABLE.has(path.replace(/^plugins\/[^/]+\//, ""))) chmodSync(abs, 0o755)
    }
}

/** Paths whose committed copy differs from a fresh build (missing, changed, or stale). */
export function diffBuild(root: string, files: FileMap): string[] {
    const drift: string[] = []
    for (const [path, content] of files) {
        const abs = join(root, path)
        if (!existsSync(abs) || readFileSync(abs, "utf8") !== content) drift.push(path)
    }
    for (const name of listLocales(root).map(pluginName)) {
        for (const path of listFiles(join(root, "plugins", name))) {
            if (!files.has(`plugins/${name}/${path}`)) drift.push(`plugins/${name}/${path}`)
        }
    }
    return drift.sort()
}

function renderSoulSkill(src: string): string {
    const identity = readFileSync(join(src, "soul", "identity.md"), "utf8").trim()
    const map = readFileSync(join(src, "soul", "agents.md"), "utf8").trim()
    return [
        "---",
        "name: soul",
        'description: "Full AgentSoul soul: identity, red lines, rule hierarchy and the complete map of skills and subagents. Load when a situation is ambiguous or the compact soul from the session start is not enough."',
        "---",
        "",
        identity,
        "",
        "---",
        "",
        map,
        "",
    ].join("\n")
}

function readTree(dir: string): FileMap {
    const out: FileMap = new Map()
    for (const path of listFiles(dir)) out.set(path, readFileSync(join(dir, path), "utf8"))
    return out
}

/** Relative file paths under dir (sorted, `/`-separated), skipping macOS metadata. */
function listFiles(dir: string): string[] {
    if (!existsSync(dir)) return []
    const out: string[] = []
    const walk = (d: string): void => {
        for (const entry of readdirSync(d).sort()) {
            if (entry.startsWith("._") || entry === ".DS_Store") continue
            const abs = join(d, entry)
            if (statSync(abs).isDirectory()) walk(abs)
            else out.push(relative(dir, abs).split("\\").join("/"))
        }
    }
    walk(dir)
    return out
}

function readJson(path: string): Record<string, unknown> {
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${path}: expected a JSON object`)
    return raw as Record<string, unknown>
}

function stringField(obj: Record<string, unknown>, key: string, where: string): string {
    const v = obj[key]
    if (typeof v !== "string" || v.trim() === "") throw new Error(`${where}: "${key}" must be a non-empty string`)
    return v
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 4)}\n`
