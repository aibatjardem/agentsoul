import { resolve } from "node:path"
import { loadKit } from "../kit/kit.js"
import { validateSource, validateTarget } from "../kit/validate.js"
import { printIssues } from "./report.js"

export interface CheckOptions {
    readonly target: string
    readonly coreDir: string
    readonly version: string
    /** Validate the kit sources in core/ instead of an installed project. */
    readonly source: boolean
}

/** @returns process exit code: 0 when there are no errors (warnings allowed) */
export function runCheck(options: CheckOptions): number {
    const kit = loadKit(options.coreDir)
    if (options.source) {
        console.log(`AgentSoul check (kit sources) → ${options.coreDir}`)
        console.log("")
        return printIssues(validateSource(kit)) === 0 ? 0 : 1
    }
    const target = resolve(options.target)
    console.log(`AgentSoul check → ${target}`)
    console.log("")
    return printIssues(validateTarget(target, kit, options.version)) === 0 ? 0 : 1
}
