/* eslint new-cap:0, no-loop-func:0 */
import fdir from 'fdir'
import Errlop from 'errlop'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'

import { resolve, join, extname, dirname } from 'path'
import { promises as fsPromises, exists as fsExists } from 'fs'

import { inspect } from './log.js'

async function rimrafp(p: string) {
	return new Promise(function (resolve, reject) {
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

// https://deno.land/std/node
const builtins = [
	'assert',
	'buffer',
	'child_process',
	'cluster',
	'console',
	'crypto',
	'dgram',
	'dns',
	'events',
	'fs',
	'http',
	'http2',
	'https',
	'module',
	'net',
	'os',
	'path',
	'perf_hooks',
	'process',
	'querystring',
	'readline',
	'repl',
	'stream',
	'string_decoder',
	'sys',
	'timers',
	'tls',
	'tty',
	'url',
	'util',
	'v8',
	'vm',
	'worker_threads',
	'zlib',
]
const compat = [
	'events',
	'fs',
	'module',
	'os',
	'path',
	'process',
	'querystring',
	'timers',
	'util',
]

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
	/** absolute filesystem path */
	path: string
	/** relative to the package directory */
	filename: string
	/** deno edition path */
	denoPath: string
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
	errors: Set<string>
	warnings: Set<string>
}

export function convert(path: string, details: Details): File {
	// prepare
	const file = details.files[path]

	// extract imports
	const matches = file.source.matchAll(/ from ['"]([^'"]+)['"]/g)
	for (const match of matches) {
		const i: Import = {
			type: null,
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
					`import of [${i.sourceTarget}] resolves to [${i.path}] which is not a typescript file inside the source edition`
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
				i.package = '/' + parts.shift()
			}
			// remaining parts will be the manual entry
			i.entry = parts.join('/')
			// actually continue
		} else {
			// no custom entry
			i.package = sourceTarget
		}

		// check if builtin
		if (!i.entry && builtins.includes(i.package)) {
			i.type = 'builtin'

			// check for compat
			if (compat.includes(i.package)) {
				i.resultTarget = `https://deno.land/std/node/${i.package}.ts`
				continue
			}

			// fail as the builtin does not yet have a compatibility proxy
			i.errors.add(
				`import of [${i.sourceTarget}] is for a node.js builtin that does not yet have a deno compatibility layer`
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
						`import of [${i.sourceTarget}] resolved to an entry of [${entry}], which is not a typescript file`
					)
					continue
				}
			}

			// invalid dependnecy import
			i.errors.add(
				`import of [${i.sourceTarget}] appears to be a dependency that is uninstalled, install it and try again`
			)
		}
	}

	// perform the replacements
	let result = file.source
	let offset = 0
	for (const i of file.imports) {
		if (!i.resultTarget) continue
		const cursor = i.sourceIndex + offset
		const replacement = i.sourceStatement.replace(
			i.sourceTarget,
			i.resultTarget
		)
		result =
			result.substring(0, cursor) +
			replacement +
			result.substring(cursor + i.sourceStatement.length)
		offset += replacement.length - i.sourceStatement.length
	}
	file.result = result

	// return
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
}

export async function make({
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
	const denoEditionDirectory = 'edition-deno'
	const denoEditionPath = join(cwd, denoEditionDirectory)
	const nm = join(cwd, 'node_modules')

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

	// get the ts files of the source directory
	const sourceEditionPath = join(cwd, pkg.editions[0].directory)
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
		errors: new Set<string>(),
		warnings: new Set<string>(),
	}

	// add the dependencies
	for (const [name, version] of Object.entries(
		Object.assign(pkg.dependencies || {}, pkg.devDependencies || {})
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
				// don't change success, as this dependnecy may not be actually be used
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
			const file: File = {
				path,
				filename,
				denoPath: join(denoEditionPath, filename),
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
				if (i.dep?.errors.size) {
					for (const e of i.dep.errors) {
						i.errors.add(
							`import of dependency [${i.sourceTarget}] has incompatibility: ${e}`
						)
					}
				}

				// bubble file import errors
				if (i.file?.errors.size) {
					for (const e of i.file.errors) {
						i.errors.add(
							`import of file [${i.sourceTarget}] has incompatibility: ${e}`
						)
					}
				}
				// bubble import errors
				if (i.errors.size) {
					for (const e of i.errors) {
						file.errors.add(`file [${file.path}] has incompatibility: ${e}`)
					}
				}
			}
		}
	}

	// check if we care about the errors or not
	for (const path of paths) {
		const file = convert(path, details)
		if (file.errors.size) {
			if (file.filename === sourceEdition.entry) {
				// entry
				if (failOnEntryIncompatibility) {
					for (const e of file.errors) {
						details.errors.add(
							`entry file [${file.path}] has incompatibility: ${e}`
						)
					}
				} else {
					for (const e of file.errors) {
						details.errors.add(
							`optional entry file [${file.path}] has incompatibility: ${e}`
						)
					}
				}
			} else if (file.filename.includes('test')) {
				// test
				if (failOnTestIncompatibility) {
					for (const e of file.errors) {
						details.errors.add(
							`test file [${file.path}] has incompatibility: ${e}`
						)
					}
				} else {
					for (const e of file.errors) {
						details.errors.add(
							`optional test file [${file.path}] has incompatibility: ${e}`
						)
					}
				}
			} else {
				// other
				// eslint-disable-next-line no-lonely-if
				if (failOnOtherIncompatibility) {
					for (const e of file.errors) {
						details.errors.add(
							`utility file [${file.path}] has incompatibility: ${e}`
						)
					}
				} else {
					for (const e of file.errors) {
						details.errors.add(
							`optional utility file [${file.path}] has incompatibility: ${e}`
						)
					}
				}
			}
		}
	}

	// if successful, write the new files
	if (details.errors.size === 0) {
		for (const file of Object.values(details.files)) {
			// write the successful files only
			if (file.errors.size === 0) {
				if (file.result == null)
					throw new Error('the file had no errors, yet had no content')
				await ensureFile(file.denoPath, file.result)
			}
		}
	}

	// delete deno edition entry, will be re-added later if it is suitable
	pkg.editions = pkg.editions.filter(
		(e: any) => e.directory !== denoEditionDirectory
	)

	// change package.json for failure
	if (details.errors.size) {
		// delete deno keywords
		const keywords = new Set<string>(pkg.keywords || [])
		keywords.delete('deno')
		keywords.delete('denoland')
		keywords.delete('deno-edition')
		pkg.keywords = Array.from(keywords).sort()

		// delete deno entry
		delete pkg.deno

		// save
		writeJSON(pkgPath, pkg)
	}
	// change package.json for success
	else {
		// add deno keywords
		const keywords = new Set<string>(pkg.keywords || [])
		keywords.add('deno')
		keywords.add('denoland')
		keywords.add('deno-edition')
		pkg.keywords = Array.from(keywords).sort()

		// add deno edition
		const denoEdition = {
			description: 'TypeScript source code made to be compatible with Deno',
			directory: denoEditionDirectory,
			entry: sourceEdition.entry,
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

	// return details
	return details
}
