import { parse } from "yaml"

/** Markdown file split into its YAML frontmatter and body. */
export interface FrontmatterDoc {
    readonly data: Record<string, unknown>
    readonly body: string
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/

/**
 * Parses a markdown document with a leading `---` YAML block.
 *
 * @throws Error when the block is missing, is not valid YAML, or is not a mapping.
 */
export function parseFrontmatter(source: string): FrontmatterDoc {
    const match = FRONTMATTER.exec(source)
    if (match === null || match[1] === undefined) {
        throw new Error("no YAML frontmatter (expected a leading --- block)")
    }
    const data: unknown = parse(match[1])
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("frontmatter is not a YAML mapping")
    }
    return { data: data as Record<string, unknown>, body: source.slice(match[0].length) }
}

/**
 * Sets (or removes, when `value` is null) one top-level `key: value` line in the
 * frontmatter, leaving every other byte of the document untouched. Rewriting the
 * whole YAML block would reformat author-written fields and create noise diffs.
 *
 * @param value raw YAML text for the value, e.g. `opus` or `[a, b]`
 */
export function setFrontmatterLine(source: string, key: string, value: string | null): string {
    const match = FRONTMATTER.exec(source)
    if (match === null || match[1] === undefined) {
        throw new Error("no YAML frontmatter (expected a leading --- block)")
    }
    const lines = match[1].split("\n")
    const index = lines.findIndex((l) => l.startsWith(`${key}:`))
    if (value === null) {
        if (index !== -1) lines.splice(index, 1)
    } else if (index === -1) {
        lines.push(`${key}: ${value}`)
    } else {
        lines[index] = `${key}: ${value}`
    }
    return `---\n${lines.join("\n")}\n---\n${source.slice(match[0].length)}`
}
