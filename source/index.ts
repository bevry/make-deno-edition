/* eslint new-cap:0 */
import fdir from 'fdir'
import Errlop from 'errlop'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'

import { resolve, join, extname, dirname } from 'path'
import { promises as fsPromises, exists as fsExists } from 'fs'

import * as log from './log.js'

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

export interface Dependencies {
	[key: string]: string
}

export interface Imports {
	[key: string]: [RegExpMatchArray, Error | string]
}

export interface Files {
	[path: string]: Error | string
}

export interface ConvertOpts {
	path: string
	cache: Files
	nm: string
	deps: Dependencies
	devDeps: Dependencies
}

export async function convert(opts: ConvertOpts): Promise<Error | string> {
	// prepare
	const { path, cache, nm, deps, devDeps } = opts

	// check
	const cachedResult = cache[path]
	if (cachedResult) {
		return cachedResult
	}
	if ((await exists(path)) === false) {
		const error = new Error(`${path}: does not exist`)
		cache[path] = error
		log.warn(error)
		return error
	}

	// get the file content
	const sourceContent = await readFile(path, 'utf-8')
	const imports: Imports = {}
	const postponed: Array<() => Promise<void>> = []

	// get the imports
	const matches = sourceContent.matchAll(/ from ['"]([^'"]+)['"]/g)
	for (const match of matches) {
		// const index = match.index
		const source = match[1]
		let target = source
		let error: Error | undefined

		// check if local dependency, if so, ensure .ts extension
		// and ensure it is supported itself
		if (source.startsWith('.')) {
			log.log(`${path}: imports internal path [${source}]`)

			// ensure extension
			if (source.endsWith('/')) {
				target += 'index.ts'
				log.log(`${path}: mapped [${source}] to [${target}]`)
			} else {
				const ext = extname(source)
				if (ext === '') {
					target = source + '.ts'
					log.log(`${path}: mapped [${source}] to [${target}]`)
				} else if (ext === '.js') {
					target = source.replace(ext, '.ts')
					log.log(`${path}: mapped [${source}] to [${target}]`)
				} else if (ext !== '.ts') {
					error = new Error(
						`${path}: imported [${source}] which had an unsupported extension of [${ext}]`
					)
					log.warn(error)
				}
			}

			// convert it premptively, to ensure it is also suitable
			if (!error) {
				// queue the conversion of this file, after we have injected this file into the cache
				postponed.push(async function () {
					const targetPath = resolve(dirname(path), target)
					try {
						await convert({ ...opts, path: targetPath })
					} catch (err) {
						error = new Errlop(
							`${path}: failed to import [${source}] which we tried to resolve to [${targetPath}]`,
							err
						)
						log.warn(error)
						imports[source] = [match, error]
					}
				})
			}

			// map
			imports[source] = [match, error || target]
			continue
		}

		// check if remote depednency, if so, ignore
		if (
			source.startsWith('http:') ||
			source.startsWith('https:') ||
			source.startsWith('/')
		) {
			log.log(`${path}: imports remote path [${source}]`)
			imports[source] = [match, source]
			continue
		}

		// check if package path, or remote dependency
		let dep: string = source,
			entry = ''
		if (source.includes('/')) {
			const parts = source.split('/')
			dep = parts.shift()!
			if (dep[0] === '@') {
				dep += '/' + parts.shift()
			}
			entry = parts.join('/')
			log.log(
				`${path}: imports suspected package [${dep}] with entry [${entry}]`
			)
			// actually continue
		}

		// check if builtin
		if (!entry && builtins.includes(dep)) {
			// otherwise, probably node builtin, check for compat
			if (compat.includes(dep)) {
				target = `https://deno.land/std/node/${dep}.ts`
				log.log(
					`${path}: imports node builtin [${dep}] with compat at [${target}]`
				)
				imports[source] = [match, target]
				continue
			}

			// fail as non-compat node builtin
			error = new Error(
				`${path}: imports node builtin [${dep}] which does not have a compat layer`
			)
			log.warn(error)
			imports[source] = [match, error]
		} else {
			// check if package, if so, check for deno entry, if so use that, otherwise use main
			const version = deps[dep] ?? devDeps[dep]
			if (version) {
				try {
					// consider fetching from unpkg rather than node_modules
					const depPkgPath = join(nm, dep, 'package.json')
					const depPkg = await readJSON(depPkgPath).catch((err) =>
						Promise.reject(
							new Errlop(
								`${path}: imports a known but uninstalled dependency [${dep}]: install it to node_modules and try again`,
								err
							)
						)
					)
					const deno = depPkg?.deno
					const main = depPkg?.main
					const resolvedEntry = entry || deno || main
					const target = `https://unpkg.com/${dep}@${version}/${resolvedEntry}`
					log.log(`${path}: imports package [${target}]`)
					if (!resolvedEntry.endsWith('.ts')) {
						error = new Error(
							`${path}: imported [${source}] which had an extension other than .ts`
						)
						log.warn(error)
					}
					imports[source] = [match, error || target]
					continue
				} catch (error) {
					imports[source] = [match, error]
					log.warn(error)
				}
			}

			// uninstalled dependency
			error = new Error(
				`${path}: imports an unknown dependency [${dep}]: add it to package.json and try again`
			)
			log.warn(error)
			imports[source] = [match, error]
		}
	}

	// check for errors
	let resultContent = sourceContent
	let error: Error | null = null
	for (const [source, [match, result]] of Object.entries(imports)) {
		if (result instanceof Error) {
			error = new Errlop(result, error)
			continue
		}
	}

	// write to cache
	cache[path] = error || resultContent

	// do the postponed items
	await Promise.all(postponed.map((p) => p()))

	// now that locals (and thus possibly circular are added)
	// which makes our conversions complete, do a
	let offset = 0
	error = null
	for (const [source, [match, result]] of Object.entries(imports)) {
		if (result instanceof Error) {
			error = new Errlop(result, error)
			continue
		}
		const target = result
		const cursor = match.index! + offset
		const source = match[0]
		const replacement = source.replace(match[1], target)
		resultContent =
			resultContent.substring(0, cursor) +
			replacement +
			resultContent.substring(cursor + source.length)
		offset += replacement.length - source.length
	}

	// write to cache
	cache[path] = error || resultContent

	// return
	if (error) {
		log.warn(`${path}: has incompatibilities:\n`, error.stack)
		return error
	} else {
		log.success(`${path}: converted to deno successfully`)
		return resultContent
	}
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
}: MakeOpts = {}) {
	// paths
	const pkgPath = join(cwd, 'package.json')
	const pkg = await readJSON(pkgPath).catch((err) =>
		Promise.reject(new Errlop('require package.json file to be present', err))
	)

	// prepare
	const denoEditionDirectory = 'edition-deno'
	const denoEditionPath = join(cwd, denoEditionDirectory)
	const nm = join(cwd, 'node_modules')
	const deps: Dependencies = pkg.dependencies || {}
	const devDeps: Dependencies = pkg.devDependencies || {}

	// check editions
	const sourceEdition = pkg?.editions && pkg.editions[0]
	if (
		!sourceEdition ||
		!sourceEdition.tags?.includes('typescript') ||
		!sourceEdition.tags?.includes('import')
	) {
		throw new Error(
			'package.json require typescript source edition that uses ESM, refer to https://editions.bevry.me'
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

	// convert all the files
	let fail: Error | undefined
	const files: Files = {}
	for (const path of paths) {
		const filename = path.replace(sourceEditionPath + '/', '')
		const result = await convert({ path, cache: files, nm, deps, devDeps })
		if (result instanceof Error) {
			if (filename === sourceEdition.entry) {
				// entry
				if (failOnEntryIncompatibility) {
					const error = new Errlop(
						`${path}: has entry incompatibilities`,
						result
					)
					log.error(error)
					fail = new Errlop(error, fail)
				} else {
					const error = new Errlop(
						`${path}: has entry incompatibilities, which we have configured to ignore`,
						result
					)
					log.special(error)
				}
			} else if (filename.includes('test')) {
				// test
				if (failOnTestIncompatibility) {
					const error = new Errlop(
						`${path}: has test incompatibilities`,
						result
					)
					log.error(error)
					fail = new Errlop(error, fail)
				} else {
					const error = new Errlop(
						`${path}: has test incompatibilities, which we have configured to ignore`,
						result
					)
					log.special(error)
				}
			} else {
				// other
				// eslint-disable-next-line no-lonely-if
				if (failOnOtherIncompatibility) {
					const error = new Errlop(
						`${path}: has other incompatibilities`,
						result
					)
					log.error(error)
					fail = new Errlop(error, fail)
				} else {
					const error = new Errlop(
						`${path}: has other incompatibilities, which we have configured to ignore`,
						result
					)
					log.special(error)
				}
			}
		} else {
			// write the new files
			const denoPath = join(denoEditionPath, filename)
			log.status(`writing [${denoPath}]...`)
			await ensureFile(denoPath, result)
			log.status(`...wrote [${denoPath}]`)
		}
	}

	// delete deno edition, will be re-added later if it is suitable
	pkg.editions = pkg.editions.filter(
		(e: any) => e.directory !== denoEditionDirectory
	)

	// failure
	if (fail) {
		// delete deno entry
		delete pkg.deno

		// save
		writeJSON(pkgPath, pkg)

		// return
		return Promise.reject(fail)
	} else {
		// success

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

		// return
		return true
	}
}
