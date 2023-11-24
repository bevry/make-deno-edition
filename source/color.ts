import * as ansi from '@bevry/ansi'
import { inspect as utilInspect } from 'util'

export function inspect(a: any): any {
	if (typeof a === 'string') return a
	else if (a instanceof Set) return Array.from(a).map((i) => inspect(i))
	else return utilInspect(a, { colors: true, depth: 5 })
}

export function special(...m: any) {
	return ansi.bold(ansi.underline(ansi.magenta(m.join(' '))))
}

export function warn(...m: any) {
	return ansi.bold(ansi.underline(ansi.yellow(m.join(' '))))
}

export function error(...m: any) {
	return ansi.bold(ansi.underline(ansi.red(m.join(' '))))
}

export function success(...m: any) {
	return ansi.bold(ansi.underline(ansi.green(m.join(' '))))
}
