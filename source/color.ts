import chalk from 'chalk'
import { inspect as utilInspect } from 'util'

export function inspect(a: any): any {
	if (typeof a === 'string') return a
	else if (a instanceof Set) return Array.from(a).map((i) => inspect(i))
	else return utilInspect(a, { colors: true, depth: 5 })
}

export function special(...m: any) {
	return chalk.bold.underline.magenta(...m)
}

export function warn(...m: any) {
	return chalk.bold.underline.yellow(...m)
}

export function error(...m: any) {
	return chalk.bold.underline.red(...m)
}

export function success(...m: any) {
	return chalk.bold.underline.green(...m)
}
