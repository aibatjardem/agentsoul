import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { CLAUDE_MD_PATH, upsertBlock } from "./claude-md.js"
import { defaultConfig, readConfig } from "./config.js"
import { DEFAULT_PROFILE, renderManaged, renderSeed, type Kit } from "./kit.js"
import { MANIFEST_PATH, readManifest, serializeManifest, sha256, type Manifest } from "./manifest.js"

/** Suffix for the incoming kit version when a managed file was edited locally. */
export const NEW_SUFFIX = ".agentsoul-new"

export type Action =
    /** managed file missing on disk → write it */
    | "add"
    /** unmodified locally, kit changed → replace */
    | "update"
    /** disk already equals the kit version */
    | "unchanged"
    /** edited locally, kit did not change → leave the local version */
    | "keep-local"
    /** edited locally and kit changed → write `<file>.agentsoul-new` next to it */
    | "conflict"
    /** edited locally, replaced anyway because of --force (backed up first) */
    | "overwrite"
    /** user merged the new version by hand (`--resolve`) → accept disk as the new base */
    | "resolve"
    /** kit dropped the file and it was unmodified (or is a known 0.1 leftover) → delete (backed up) */
    | "remove"
    /** kit dropped the file but it was edited locally → keep it, stop tracking */
    | "orphan"
    /** project-owned seed file missing → write it once */
    | "seed"

export interface PlanItem {
    readonly path: string
    readonly action: Action
    /** content to write (add / update / overwrite / conflict / seed) */
    readonly content?: string
}

export interface Plan {
    readonly items: readonly PlanItem[]
    readonly claudeMd: { readonly before: string | null; readonly after: string }
    readonly manifest: Manifest
    readonly legacy: boolean
}

export interface PlanOptions {
    readonly kit: Kit
    readonly target: string
    readonly version: string
    /** Profile for a fresh install; ignored when `.soul/config.json` already names one. */
    readonly profile?: string
    readonly force: boolean
    /** Managed paths whose local version the user has merged with the kit and accepts. */
    readonly resolve?: readonly string[]
}

/** Computes what an install/update would do. Pure with respect to the target: reads only. */
export function planInstall(options: PlanOptions): Plan {
    const { kit, target, force } = options
    const manifest = readManifest(target)
    const config =
        readConfig(target) ?? defaultConfig(options.profile ?? manifest?.profile ?? DEFAULT_PROFILE)
    const resolve = new Set(options.resolve ?? [])

    const desired = renderManaged(kit, config)
    const seed = renderSeed(kit, config.profile)
    const items: PlanItem[] = []
    const files: Record<string, string> = {}
    const legacy = manifest === null && existsSync(join(target, ".soul"))

    /**
     * Base hash = the kit version the project last accepted. From the manifest when there is
     * one; for a 0.1 install, the disk hash itself if it matches a file 0.1 shipped verbatim.
     */
    const baseOf = (path: string, current: string): string | undefined => {
        if (manifest !== null) return manifest.files[path]
        return legacy && kit.legacy.get(path)?.has(current) === true ? current : undefined
    }

    for (const unknownPath of resolve) {
        if (!desired.has(unknownPath)) throw new Error(`--resolve ${unknownPath}: not a file managed by AgentSoul`)
    }

    for (const [path, content] of desired) {
        const disk = readOptional(join(target, path))
        const next = sha256(content)

        if (disk === null) {
            items.push({ path, action: "add", content })
            files[path] = next
            continue
        }
        const current = sha256(disk)
        const base = baseOf(path, current)
        if (current === next) {
            items.push({ path, action: "unchanged" })
            files[path] = next
        } else if (resolve.has(path)) {
            items.push({ path, action: "resolve" })
            files[path] = next
        } else if (base !== undefined && current === base) {
            items.push({ path, action: "update", content })
            files[path] = next
        } else if (base !== undefined && next === base) {
            items.push({ path, action: "keep-local" })
            files[path] = base
        } else if (force) {
            items.push({ path, action: "overwrite", content })
            files[path] = next
        } else {
            items.push({ path, action: "conflict", content })
            // Unknown base for 0.1 installs: "" never matches a real hash, so the file stays
            // in conflict until the user resolves it — it can never be silently overwritten.
            files[path] = base ?? ""
        }
    }

    // Files the kit used to ship but no longer does: delete if untouched, otherwise keep as orphan.
    const previouslyShipped: Iterable<string> = manifest !== null ? Object.keys(manifest.files) : legacy ? kit.legacy.keys() : []
    for (const path of previouslyShipped) {
        if (desired.has(path)) continue
        const disk = readOptional(join(target, path))
        if (disk === null) continue
        items.push({ path, action: baseOf(path, sha256(disk)) === sha256(disk) ? "remove" : "orphan" })
    }

    // Seeds restore missing project files, except local-rule templates: once .soul/local/ exists
    // the project owns its contents, and a deleted template must stay deleted.
    const hasLocalDir = existsSync(join(target, ".soul", "local"))
    const seededLocal: string[] = []
    for (const [path, content] of seed) {
        if (existsSync(join(target, path)) || (hasLocalDir && isLocalRule(path))) continue
        items.push({ path, action: "seed", content })
        if (isLocalRule(path)) seededLocal.push(path)
    }

    const localFiles = [...new Set([...listLocalRules(target), ...seededLocal])]
    const before = readOptional(join(target, CLAUDE_MD_PATH))
    return {
        items,
        claudeMd: { before, after: upsertBlock(before, localFiles) },
        manifest: { version: options.version, profile: config.profile, files },
        legacy,
    }
}

export interface ApplyResult {
    readonly backupDir: string | null
}

/**
 * Writes a plan to disk. Every file that is overwritten or deleted is first copied
 * to `.soul/.backup/<timestamp>/`, so nothing the user had is ever lost.
 */
export function applyPlan(plan: Plan, target: string, now: Date = new Date()): ApplyResult {
    const stamp = now.toISOString().replace(/[:.]/g, "-")
    const backupRoot = join(target, ".soul", ".backup", stamp)
    let backedUp = false
    const backup = (path: string): void => {
        const from = join(target, path)
        if (!existsSync(from)) return
        const to = join(backupRoot, path)
        mkdirSync(dirname(to), { recursive: true })
        copyFileSync(from, to)
        backedUp = true
    }

    for (const item of plan.items) {
        const abs = join(target, item.path)
        switch (item.action) {
            case "add":
            case "update":
            case "seed":
                write(abs, item.content)
                dropNew(abs)
                break
            case "overwrite":
                backup(item.path)
                write(abs, item.content)
                dropNew(abs)
                break
            case "conflict":
                write(abs + NEW_SUFFIX, item.content)
                break
            case "resolve":
            case "unchanged":
                dropNew(abs)
                break
            case "remove":
                backup(item.path)
                rmSync(abs, { force: true })
                break
            case "keep-local":
            case "orphan":
                break
        }
    }

    if (plan.claudeMd.before !== plan.claudeMd.after) {
        backup(CLAUDE_MD_PATH)
        write(join(target, CLAUDE_MD_PATH), plan.claudeMd.after)
    }
    write(join(target, MANIFEST_PATH), serializeManifest(plan.manifest))

    if (backedUp) {
        const ignore = join(target, ".soul", ".backup", ".gitignore")
        if (!existsSync(ignore)) write(ignore, "*\n")
    }
    return { backupDir: backedUp ? backupRoot : null }
}

/** Project-relative paths of `.soul/local/*.md`. */
export function listLocalRules(target: string): string[] {
    const dir = join(target, ".soul", "local")
    if (!existsSync(dir)) return []
    return readdirSync(dir)
        .filter((f) => f.endsWith(".md") && !f.startsWith("._"))
        .sort()
        .map((f) => `.soul/local/${f}`)
}

function isLocalRule(path: string): boolean {
    return /^\.soul\/local\/[^/]+\.md$/.test(path)
}

function readOptional(path: string): string | null {
    return existsSync(path) ? readFileSync(path, "utf8") : null
}

function write(path: string, content: string | undefined): void {
    if (content === undefined) throw new Error(`internal: no content planned for ${path}`)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content, "utf8")
}

function dropNew(abs: string): void {
    rmSync(abs + NEW_SUFFIX, { force: true })
}
