import { readdirSync, statSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join, dirname, relative } from "node:path"

/**
 * Рекурсивно копирует файлы из src в dest.
 * Если файл в dest уже есть — поведение зависит от `onExist`.
 */
export function copyTree(
    src: string,
    dest: string,
    onExist: "skip" | "overwrite" | "fail" = "skip",
): { copied: string[]; skipped: string[]; overwritten: string[] } {
    const copied: string[] = []
    const skipped: string[] = []
    const overwritten: string[] = []

    function walk(srcPath: string, destPath: string): void {
        const st = statSync(srcPath)
        if (st.isDirectory()) {
            mkdirSync(destPath, { recursive: true })
            for (const entry of readdirSync(srcPath)) {
                walk(join(srcPath, entry), join(destPath, entry))
            }
        } else {
            const rel = relative(src, srcPath)
            if (existsSync(destPath)) {
                if (onExist === "skip") {
                    skipped.push(rel)
                    return
                }
                if (onExist === "fail") {
                    throw new Error(`File already exists: ${destPath}`)
                }
                overwritten.push(rel)
            } else {
                copied.push(rel)
            }
            mkdirSync(dirname(destPath), { recursive: true })
            const content = readFileSync(srcPath)
            writeFileSync(destPath, content)
        }
    }

    walk(src, dest)
    return { copied, skipped, overwritten }
}

/**
 * Пишет файл, создавая директории по пути, если их нет.
 * Если файл уже существует и force=false — не перезаписывает.
 */
export function writeFileSafe(
    path: string,
    content: string,
    force = false,
): { written: boolean; reason?: string } {
    if (existsSync(path) && !force) {
        return { written: false, reason: "file already exists" }
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content, "utf8")
    return { written: true }
}
