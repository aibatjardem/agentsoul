import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

/**
 * File operations confined to a target project.
 *
 * The project tree is untrusted input: `.soul/.agentsoul.json` and `.claude/` arrive with a
 * cloned repo. Every path is therefore checked before it is touched:
 *   - it must resolve inside the target directory;
 *   - no component between the target and the file (the file included) may be a symlink,
 *     so a planted `.claude/agents -> ~/.ssh` cannot redirect a write or a delete.
 */
export function insidePath(target: string, rel: string): string {
    const root = realpathSync(target)
    const abs = resolve(root, rel)
    const back = relative(root, abs)
    if (back === "" || back.startsWith("..") || isAbsolute(back)) {
        throw new Error(`refusing path "${rel}": outside the project directory`)
    }
    let current = root
    for (const segment of back.split(sep)) {
        current = join(current, segment)
        if (!existsSync(current) && !isDanglingLink(current)) break
        if (lstatSync(current).isSymbolicLink()) {
            throw new Error(`refusing path "${rel}": ${relative(root, current)} is a symlink`)
        }
    }
    return abs
}

export function safeExists(target: string, rel: string): boolean {
    return existsSync(insidePath(target, rel))
}

export function safeRead(target: string, rel: string): string | null {
    const abs = insidePath(target, rel)
    return existsSync(abs) ? readFileSync(abs, "utf8") : null
}

export function safeWrite(target: string, rel: string, content: string): void {
    const abs = insidePath(target, rel)
    mkdirSync(dirname(abs), { recursive: true })
    insidePath(target, rel) // the chain now exists in full — verify it once more before writing
    writeFileSync(abs, content, "utf8")
}

export function safeRemove(target: string, rel: string): void {
    rmSync(insidePath(target, rel), { force: true })
}

/** Copies a project file to another project-relative location (used for backups). */
export function safeCopy(target: string, fromRel: string, toRel: string): void {
    const from = insidePath(target, fromRel)
    const to = insidePath(target, toRel)
    mkdirSync(dirname(to), { recursive: true })
    insidePath(target, toRel)
    copyFileSync(from, to)
}

function isDanglingLink(path: string): boolean {
    try {
        return lstatSync(path).isSymbolicLink()
    } catch {
        // lstat fails only when nothing exists at the path — not a link.
        return false
    }
}
