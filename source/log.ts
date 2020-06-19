import chalk from 'chalk'
import { inspect as utilInspect } from 'util'

export function inspect(a: any): any {
	if (typeof a === 'string') return a
	else if (a instanceof Set) return Array.from(a).map((i) => inspect(i))
	else return utilInspect(a, { colors: true, depth: 5 })
}

export function details(...m: any) {
	console.log(...m.map((m: any) => inspect(m)))
}

export function special(...m: any) {
	process.stderr.write(chalk.bold.underline.magenta(...m) + '\n')
}

export function warn(...m: any) {
	process.stderr.write(chalk.bold.underline.yellow(...m) + '\n')
}

export function error(...m: any) {
	process.stderr.write(chalk.bold.underline.red(...m) + '\n')
}

export function success(...m: any) {
	process.stderr.write(chalk.bold.underline.green(...m) + '\n')
}

export function log(...m: any) {
	console.log(...m)
}
