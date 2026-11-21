import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export const MANIFEST_PATH = ".soul/.agentsoul.json"

/**
 * Record of what AgentSoul installed. For every managed file it stores the hash of
 * the kit version last accepted into the project (the "base"), which makes a
 * three-way decision possible without keeping full copies:
 *   disk == base             → untouched locally, safe to replace
 *   disk != base, new == base → local edit, kit unchanged → keep local
 *   disk != base, new != base → both changed → conflict
 */
export interface Manifest {
    readonly version: string
    readonly profile: string
    readonly files: Readonly<Record<string, string>>
}

export function sha256(content: string): string {
    return createHash("sha256").update(content).digest("hex")
}

/**
 * Reads the manifest. Returns null when AgentSoul was never installed here,
 * or was installed by 0.1.x which did not write one.
 *
 * @throws Error when the file exists but is malformed.
 */
export function readManifest(target: string): Manifest | null {
    const path = join(target, MANIFEST_PATH)
    if (!existsSync(path)) return null
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (
        raw === null ||
        typeof raw !== "object" ||
        !("version" in raw) ||
        typeof raw.version !== "string" ||
        !("profile" in raw) ||
        typeof raw.profile !== "string" ||
        !("files" in raw) ||
        raw.files === null ||
        typeof raw.files !== "object"
    ) {
        throw new Error(`${MANIFEST_PATH} is malformed — delete it and run \`agentsoul update --force\``)
    }
    const files: Record<string, string> = {}
    for (const [path, hash] of Object.entries(raw.files)) {
        // The manifest ships inside the project repo, so it is untrusted input: a key like
        // "../../.bashrc" must never reach a read, write or delete.
        if (!isManagedPath(path)) {
            throw new Error(`${MANIFEST_PATH}: refusing path "${path}" — outside AgentSoul's managed namespaces`)
        }
        if (typeof hash === "string") files[path] = hash
    }
    return { version: raw.version, profile: raw.profile, files }
}

/**
 * True for a plain relative path inside a namespace AgentSoul manages
 * (`.soul/`, `.claude/agents/`, `.claude/skills/`, or the 0.1 bash validator).
 */
export function isManagedPath(path: string): boolean {
    if (path === "scripts/check-soul.sh") return true
    if (path.includes("\\") || path.includes("\0") || path.startsWith("/")) return false
    if (path.split("/").some((seg) => seg === ".." || seg === "." || seg === "")) return false
    return /^(\.soul\/|\.claude\/agents\/|\.claude\/skills\/)/.test(path)
}

export function serializeManifest(manifest: Manifest): string {
    const files = Object.fromEntries(Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)))
    return `${JSON.stringify({ ...manifest, files }, null, 4)}\n`
}
