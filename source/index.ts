/* eslint new-cap:0, no-loop-func:0, camelcase:0, no-use-before-define:0  */
import { fdir } from 'fdir'
import Errlop from 'errlop'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'

import { resolve, join, extname, dirname } from 'path'
import { promises as fsPromises, exists as fsExists } from 'fs'

import spawn from 'await-spawn'

import * as color from './color.js'

async function rimrafp(p: string) {
	return new Promise<void>(function (resolve, reject) {
		rimraf(p, function (err) {
			if (err) return reject(err)
			resolve()
		})
	})
}
const { readFile, writeFile } = fsPromises
async function exists(p: string) {
	return new Promise(function (resolve) {
		fsExists(p, resolve)
	})
}
async function readJSON(path: string) {
	return JSON.parse(await readFile(path, 'utf-8'))
}
async function writeJSON(path: string, data: object) {
	const str = JSON.stringify(data, null, '  ')
	await writeFile(path, str, 'utf-8')
}

async function ensureFile(p: string, data: string) {
	await mkdirp(dirname(p))
	return await writeFile(p, data)
}

const trim: string[] = [
	'cross-fetch',
	'fetch-client',
	'fetch-h2',
	'fetch-lite',
	'isomorphic-fetch',
	'isomorphic-unfetch',
	'node-fetch',
	'unfetch',
]

const perms: string[] = [
	'all',
	'env',
	'hrtime',
	'net',
	'plugin',
	'read',
	'run',
	'write',
]

// test ground: https://repl.it/@balupton/match-import#index.js
// @todo add tests here instead
export const importRegExp =
	/^(?:import|export(?! (?:async|function|interface|type|class))) .+? from ['"]([^'"]+)['"]$/gms

// https://deno.land/std/node
const builtins: { [key: string]: boolean | string } = {
	assert: true,
	buffer: true,
	child_process: false,
	cluster: false,
	console: false,
	crypto: false,
	dgram: false,
	dns: false,
	events: true,
	fs: true,
	http: false,
	http2: false,
	https: false,
	module: true,
	net: false,
	os: true,
	path: true,
	perf_hooks: false,
	process: true,
	querystring: true,
	readline: false,
	repl: false,
	stream: false,
	string_decoder: false,
	sys: false,
	timers: true,
	tls: false,
	tty: false,
	url: true,
	util: true,
	v8: false,
	vm: false,
	worker_threads: false,
	zlib: false,
}

export interface CompatibilityStatus {
	success: true
	message: string
}

export interface Import {
	/** The type of import:
	 * - internal imports are mapped to their typescript file that should exist within the source directory
	 * - remote imports are assumed to be compatible
	 * - dep imports are mapped to a typescript entry, via manual entry, deno entry, or main entry
	 * - builtin imports are proxied to their deno compat layer if available
	 */
	type: null | 'internal' | 'remote' | 'dep' | 'builtin'
	label: string
	sourceIndex: number
	sourceStatement: string
	sourceTarget: string
	resultStatement?: string
	resultTarget?: string
	package?: string
	entry?: string
	dep?: Dependency
	path?: string
	file?: File
	errors: Set<string>
}

export type Imports = Import[]

export interface File {
	/** what the file should be referred to as */
	label: string
	/** absolute filesystem path */
	path: string
	/** relative to the package directory */
	filename: string
	/** deno edition path */
	denoPath: string
	/** whether or not the file is necessary or not */
	necessary: boolean
	/** source file content */
	source: string
	/** result file content */
	result?: string
	imports: Imports
	errors: Set<string>
}

export interface Files {
	[path: string]: File
}

/** package.json dependencies and devDependencies fields */
export interface DependencySemvers {
	[key: string]: string
}

export interface Dependency {
	name: string
	version: string
	// json: any
	entry?: string
	url: string
	errors: Set<string>
}

export interface Dependencies {
	[key: string]: Dependency
}

export interface Details {
	files: Files
	deps: Dependencies
	success: boolean
}

function replaceImportStatement(
	sourceStatement: string,
	sourceTarget: string,
	resultTarget: string
) {
	if (!resultTarget) return ''
	const parts = sourceStatement.split(' ')
	const lastPart = parts.pop()
	const replacement = parts
		.concat([lastPart!.replace(sourceTarget, resultTarget)])
		.join(' ')
	return replacement
}

export function convert(path: string, details: Details): File {
	// prepare
	const file = details.files[path]

	// extract imports
	const matches = file.source.matchAll(importRegExp)
	for (const match of matches) {
		const i: Import = {
			type: null,
			label: match[1],
			sourceIndex: match.index!,
			sourceStatement: match[0],
			sourceTarget: match[1],
			errors: new Set<string>(),
		}
		file.imports.push(i)
	}

	// check the compat of each import
	for (const i of file.imports) {
		const { sourceTarget } = i

		// check if local dependency, if so, ensure .ts extension
		// and ensure it is supported itself
		if (sourceTarget.startsWith('.')) {
			i.type = 'internal'

			// ensure extension
			if (sourceTarget.endsWith('/')) {
				i.resultTarget = sourceTarget + 'index.ts'
			} else {
				const ext = extname(sourceTarget)
				if (ext === '') {
					i.resultTarget = sourceTarget + '.ts'
				} else if (ext) {
					i.resultTarget = sourceTarget.replace(ext, '.ts')
				}
			}

			// check the path
			i.path = resolve(dirname(path), i.resultTarget!)
			i.file = details.files[i.path]
			if (!i.file) {
				i.errors.add(
					`resolves to [${i.path}] which is not a typescript file inside the source edition`
				)
				// skip
				continue
			}

			// check of i.file.errors happens later

			// success
			continue
		}

		// check if remote depednency, if so, ignore
		if (
			sourceTarget.startsWith('http:') ||
			sourceTarget.startsWith('https:') ||
			sourceTarget.startsWith('/')
		) {
			i.type = 'remote'
			i.resultTarget = sourceTarget
			continue
		}

		// anything left over must be a dependency
		i.type = 'dep'

		// extract manual entry from package
		if (sourceTarget.includes('/')) {
			// custom entry, extract parts
			const parts = sourceTarget.split('/')
			i.package = parts.shift()!
			// if dep is a scoped package, then include the next part
			if (i.package[0] === '@') {
				i.package += '/' + parts.shift()
			}
			// remaining parts will be the manual entry
			i.entry = parts.join('/')
			// actually continue
		} else {
			// no custom entry
			i.package = sourceTarget
		}

		// check if unnecessary
		if (!i.entry && trim.includes(i.package)) {
			i.resultTarget = ''
			continue
		}

		// check if builtin
		const compat = builtins[i.package] ?? null
		if (!i.entry && compat !== null) {
			i.type = 'builtin'

			// check for compat
			if (typeof compat === 'string') {
				i.resultTarget = compat
				continue
			} else if (compat) {
				i.resultTarget = `https://deno.land/std/node/${i.package}.ts`
				continue
			}

			// fail as the builtin does not yet have a compatibility proxy
			i.errors.add(
				`is a node.js builtin that does not yet have a deno compatibility layer`
			)
			continue
		}
		// not a builtin, is a dependency, check if installed
		else {
			// check if package, if so, check for deno entry, if so use that, otherwise use main
			i.dep = details.deps[i.package]
			if (i.dep) {
				// apply
				const entry = i.entry || i.dep.entry || ''
				i.resultTarget = i.dep.url + '/' + entry

				// check of i.dep.errors happens later

				// fail if invalid entry
				if (!entry.endsWith('.ts')) {
					i.errors.add(
						`resolved to [${i.package}/${entry}], which does not have the .ts extension`
					)
					continue
				}
			} else {
				// invalid dependency import
				i.errors.add(
					`appears to be an uninstalled dependency, install it and try again`
				)
			}
		}
	}

	// perform the replacements
	let result = file.source
	let offset = 0
	for (const i of file.imports) {
		i.label = `${i.type} import of [${i.sourceTarget}] => [${i.resultTarget}]`
		if (i.resultTarget == null) {
			// error case
			continue
		}
		const cursor = i.sourceIndex + offset
		const replacement = replaceImportStatement(
			i.sourceStatement,
			i.sourceTarget,
			i.resultTarget
		)
		result =
			result.substring(0, cursor) +
			replacement +
			result.substring(cursor + i.sourceStatement.length)
		offset += replacement.length - i.sourceStatement.length
	}

	// __filename and __dirname ponyfill
	if (
		/__(file|dir)name/.test(result) &&
		/__(file|dir)name\s?=/.test(result) === false
	) {
		result =
			`import filedirname from 'https://unpkg.com/filedirname@^2.0.0/edition-deno/index.ts';\n` +
			`const [ __filename, __dirname ] = filedirname(import.meta.url);\n` +
			result
	}

	// apply and return
	file.result = result
	return file
}

export interface MakeOpts {
	/** The package directory that we will be making a deno edition for */
	cwd?: string

	/** If the entry is incompatible, then fail */
	failOnEntryIncompatibility?: boolean

	/** If any test module is incompatible, then fail */
	failOnTestIncompatibility?: boolean

	/**
	 * If any other module is incompatible, then fail.
	 * This excludes entry, which is governed by {@link failOnEntryIncompatibility}
	 * This excludes tests, which are governed by {@link failOnTestIncompatibility}
	 */
	failOnOtherIncompatibility?: boolean

	/** Whether or not to run deno on the file to verify the conversion is compatible */
	run?: boolean
}

export async function make({
	run = true,
	cwd = process.cwd(),
	failOnEntryIncompatibility = true,
	failOnTestIncompatibility = false,
	failOnOtherIncompatibility = false,
}: MakeOpts = {}): Promise<Details> {
	// paths
	const pkgPath = join(cwd, 'package.json')
	const pkg = await readJSON(pkgPath).catch((err) =>
		Promise.reject(new Errlop('require package.json file to be present', err))
	)

	// prepare
	const keywords = new Set<string>(pkg.keywords || [])
	const denoEditionDirectory = 'edition-deno'
	const denoEditionPath = join(cwd, denoEditionDirectory)
	const nm = join(cwd, 'node_modules')

	// permission args
	const permArgs: string[] = []
	for (const perm of perms) {
		const name = 'allow-' + perm
		if (keywords.has(name)) {
			const arg = '--' + name
			permArgs.push(arg)
		}
	}

	// check editions
	const sourceEdition = pkg?.editions && pkg.editions[0]
	if (
		!sourceEdition ||
		!sourceEdition.tags?.includes('typescript') ||
		!sourceEdition.tags?.includes('import')
	) {
		throw new Error(
			'make-deno-edition requires you to define the edition entry for the typescript source code\n' +
				'refer to https://github.com/bevry/make-deno-edition and https://editions.bevry.me for details'
		)
	}

	// get the source edition path
	const sourceEditionPath = join(cwd, sourceEdition.directory)

	// get the deno entry
	const denoEntry = (await exists(join(sourceEditionPath, 'deno.ts')))
		? 'deno.ts'
		: sourceEdition.entry

	// get the source edition files
	const api = new fdir()
		.withFullPaths()
		.filter((path) => path.endsWith('.ts'))
		.crawl(sourceEditionPath)
	const paths = (await api.withPromise()) as string[]

	// delete the old files
	await rimrafp(denoEditionPath)

	// prepare details
	const details: Details = {
		files: {},
		deps: {},
		success: true,
	}

	// add the dependencies
	for (const [name, version] of Object.entries(
		Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {})
	)) {
		if (details.deps[name]) {
			throw new Error(`[${name}] dependency is duplicated`)
		} else {
			const dep: Dependency = {
				name,
				version: version as string,
				url: `https://unpkg.com/${name}@${version}`,
				errors: new Set<string>(),
			}

			const path = join(nm, name, 'package.json')
			try {
				const pkg = await readJSON(path)
				const deno = pkg?.deno
				const main = pkg?.main
				dep.entry = deno || main
			} catch (err) {
				// don't change success, as this dependency may not be actually be used
				dep.errors.add(
					`dependency [${name}] does not appear installed, as [${path}] was not valid JSON, install the dependency and try again`
				)
			}

			details.deps[dep.name] = dep
		}
	}

	// add the files
	await Promise.all(
		paths.map(async (path) => {
			const filename = path.replace(sourceEditionPath + '/', '')
			const source = await readFile(path, 'utf-8')
			let necessary: boolean
			let label: string

			if (filename === denoEntry) {
				necessary = failOnEntryIncompatibility
				label = `entry file [${path}]`
			} else if (filename.includes('test')) {
				necessary = failOnTestIncompatibility
				label = `test file [${path}]`
			} else {
				necessary = failOnOtherIncompatibility
				label = `utility file [${path}]`
			}
			label = (necessary ? 'necessary ' : 'optional ') + label

			const file: File = {
				label,
				path,
				filename,
				denoPath: join(denoEditionPath, filename),
				necessary,
				source,
				imports: [],
				errors: new Set<string>(),
			}
			details.files[path] = file
		})
	)

	// convert all the files
	for (const path of Object.keys(details.files)) {
		convert(path, details)
	}

	// bubble nested errors
	for (const iteration of [1, 2]) {
		for (const [path, file] of Object.entries(details.files)) {
			for (const i of file.imports) {
				// bubble dep import errors
				if (i.dep?.errors.size)
					i.errors.add(
						`import of dependency [${i.dep.name}] has incompatibilities`
					)
				// bubble file import errors
				if (i.file?.errors.size)
					i.errors.add(
						`import of local file [${i.sourceTarget}] has incompatibilities`
					)
				// bubble import errors
				if (i.errors.size) file.errors.add(`has import incompatibilities`)
			}
		}
	}

	// check if we care about the errors or not
	for (const file of Object.values(details.files)) {
		if (file.errors.size && file.necessary) {
			details.success = false
			break
		}
	}

	// if successful, write the new files
	const denoFiles: File[] = []
	if (details.success) {
		for (const file of Object.values(details.files)) {
			// write the successful files only
			if (file.errors.size === 0) {
				if (file.result == null)
					throw new Error('the file had no errors, yet had no content')
				await ensureFile(file.denoPath, file.result)
				denoFiles.push(file)
			}
		}
	}

	// attempt to run the successful files
	if (run) {
		for (const file of denoFiles) {
			const args = ['run', ...permArgs, '--reload', '--unstable', file.denoPath]
			try {
				await spawn('deno', args)
			} catch (err) {
				file.errors.add(
					`running deno on the file failed:\n\tdeno ${args.join(' ')}\n\t` +
						String(err.stderr).replace(/\n/g, '\n\t')
				)
				if (file.errors.size && file.necessary) {
					details.success = false
				}
			}
		}
	}

	// delete deno edition entry, will be re-added later if it is suitable
	pkg.editions = pkg.editions.filter(
		(e: any) => e.directory !== denoEditionDirectory
	)

	// change package.json for success
	if (details.success) {
		// add deno keywords
		keywords.add('deno')
		keywords.add('denoland')
		keywords.add('deno-entry')
		keywords.add('deno-edition')
		pkg.keywords = Array.from(keywords).sort()

		// add deno edition
		const denoEdition = {
			description: 'TypeScript source code made to be compatible with Deno',
			directory: denoEditionDirectory,
			entry: denoEntry,
			tags: ['typescript', 'import', 'deno'],
			engines: {
				deno: true,
				browsers: Boolean(pkg.browser),
			},
		}
		pkg.editions.push(denoEdition)

		// add deno entry
		pkg.deno = join(denoEdition.directory, denoEdition.entry)

		// save
		writeJSON(pkgPath, pkg)
	}
	// change package.json for failure
	else {
		// delete deno keywords
		keywords.delete('deno')
		keywords.delete('denoland')
		keywords.delete('deno-entry')
		keywords.delete('deno-edition')
		pkg.keywords = Array.from(keywords).sort()

		// delete deno entry
		delete pkg.deno

		// save
		writeJSON(pkgPath, pkg)
	}

	// return details
	return details
}

export function inform(details: Details, verbose = false) {
	for (const path of Object.keys(details.files).sort()) {
		const file = details.files[path]
		if (file.errors.size) {
			if (verbose) {
				console.log()
			}
			if (file.necessary) {
				console.log(color.error(file.label, 'failed'))
			} else {
				console.log(color.warn(file.label, 'skipped'))
			}
			if (verbose) {
				for (const e of file.errors) {
					console.log('↳ ', e)
					for (const i of file.imports) {
						if (i.errors.size) {
							console.log('  ↳ ', i.label)
							for (const e of i.errors) {
								console.log('    ↳ ', e)
							}
						}
					}
				}
			}
		} else {
			console.log()
			console.log(color.success(file.label, 'passed'))
		}
	}
	// console.log('\ndetected dependencies:')
	// for (const key of Object.keys(details.deps).sort()) {
	// 	const dep = details.deps[key]
	// 	console.log(color.inspect(dep))
	// }
	// add dep failures?
	console.log()
}
