import chalk from 'chalk'

export function log(...m: any) {
	console.log(...m)
}

export function status(...m: any) {
	process.stdout.write(chalk.bold.underline(...m) + '\n')
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

export function fatal(...m: any) {
	error(...m)
	process.exit(1)
}
