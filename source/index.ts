/* eslint new-cap:0, no-loop-func:0, camelcase:0, no-use-before-define:0  */

// builtin
import { resolve, join, extname, dirname, sep } from 'path'

// external
import list from '@bevry/fs-list'
import remove from '@bevry/fs-remove'
import { isReadable } from '@bevry/fs-readable'
import readFile from '@bevry/fs-read'
import writeFile from '@bevry/fs-write'
import { readJSON, writeJSON } from '@bevry/json'
import Errlop from 'errlop'
import spawn from 'await-spawn'

// local
import * as color from './color.js'

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

// https://docs.deno.com/runtime/manual/node/compatibility
const builtins: { [key: string]: 'full' | 'partial' | 'none' } = {
	assert: 'full',
	async_hooks: 'partial',
	buffer: 'full',
	child_process: 'partial',
	cluster: 'none',
	console: 'full',
	crypto: 'partial',
	dgram: 'partial',
	diagnostics_channel: 'full',
	dns: 'partial',
	domain: 'none',
	events: 'full',
	fs: 'partial',
	http: 'partial',
	http2: 'partial',
	https: 'partial',
	inspector: 'partial',
	module: 'full',
	net: 'partial',
	os: 'full',
	path: 'full',
	perf_hooks: 'partial',
	punycode: 'full',
	process: 'partial',
	querystring: 'full',
	readline: 'full',
	repl: 'partial',
	stream: 'full',
	string_decoder: 'partial',
	sys: 'full',
	test: 'partial',
	timers: 'full',
	tls: 'partial',
	trace_events: 'none',
	tty: 'partial',
	util: 'full',
	url: 'full',
	v8: 'partial',
	vm: 'partial',
	wasi: 'none',
	worker_threads: 'partial',
	zlib: 'partial',
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
	type: null | 'internal' | 'remote' | 'dep' | 'builtin' | 'unnecessary'
	label: string
	sourceIndex: number
	sourceStatement: string
	sourceTarget: string
	resultStatement?: string
	resultTarget?: string
	name: string
	entry: string
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
	denoEntry: string | null
	unpkg: string
	esmsh: string
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
	resultTarget: string,
) {
	if (!resultTarget) return ''
	const parts = sourceStatement.split(' ')
	const lastPart = parts.pop()
	const replacement = parts
		.concat([lastPart!.replace(sourceTarget, resultTarget)])
		.join(' ')
	return replacement
}

function extractPackageNameAndEntry(
	input: string,
): [name: string, entry: string] {
	let name = '',
		entry = ''
	// determine it's entry
	if (input.includes('/')) {
		// custom entry, extract parts
		const parts = input.split('/')
		name = parts.shift()!
		// if dep is a scoped package, then include the next part
		if (name[0] === '@') {
			name += '/' + parts.shift()
		}
		// remaining parts will be the manual entry
		entry = parts.join('/')
	} else {
		name = input
	}
	// return
	return [name, entry]
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
			name: '',
			entry: '',
			sourceIndex: match.index!,
			sourceStatement: match[0],
			sourceTarget: match[1],
			errors: new Set<string>(),
		}
		// types
		if (i.sourceTarget.startsWith('.')) {
			i.type = 'internal'
		} else if (i.sourceTarget.startsWith('node:')) {
			i.type = 'builtin'
			const [name, entry] = extractPackageNameAndEntry(
				i.sourceTarget.substring(5),
			)
			i.name = name
			i.entry = entry
		} else if (i.sourceTarget.startsWith('npm:')) {
			i.type = 'dep'
			const [name, entry] = extractPackageNameAndEntry(
				i.sourceTarget.substring(4),
			)
			i.name = name
			i.entry = entry
		} else if (i.sourceTarget.includes(':') || i.sourceTarget.startsWith('/')) {
			i.type = 'remote'
		} else {
			// everything else must also be a dependency
			i.type = 'dep'
			const [name, entry] = extractPackageNameAndEntry(i.sourceTarget)
			i.name = name
			i.entry = entry
		}

		// handle modifications
		if (i.type === 'internal') {
			// ensure extension
			if (i.sourceTarget.endsWith('/')) {
				i.resultTarget = i.sourceTarget + 'index.ts'
			} else {
				const ext = extname(i.sourceTarget)
				if (ext === '') {
					i.resultTarget = i.sourceTarget + '.ts'
				} else if (ext) {
					i.resultTarget = i.sourceTarget.replace(ext, '.ts')
				}
			}
			// check the path
			i.path = resolve(dirname(path), i.resultTarget!)
			i.file = details.files[i.path]
			if (!i.file) {
				i.errors.add(
					`resolves to [${i.path}] which is not a typescript file inside the source edition`,
				)
			}
		} else if (i.type === 'dep') {
			const builtin = builtins[i.name] ?? null
			if (builtin) {
				// is builtin
				i.type = 'builtin'
				if (builtin === 'full' || builtin === 'partial') {
					// compatible
					i.resultTarget = i.entry
						? `node:${i.name}/${i.entry}`
						: `node:${i.name}`
				} else {
					// incompatible
					i.errors.add(
						`is a node.js builtin that does not yet have a deno compatibility layer`,
					)
				}
			} else if (!i.entry && trim.includes(i.name)) {
				// is unnecessary
				i.type = 'unnecessary'
				i.resultTarget = ''
			} else {
				// is dependency, check if installed
				i.dep = details.deps[i.name]
				if (i.dep) {
					// use manual entry, then deno entry, then no entry
					const entry = i.entry || i.dep.denoEntry || ''
					// verify the entry is compatible
					if (entry && !entry.endsWith('.ts')) {
						// check of i.dep.errors happens later
						i.errors.add(
							`resolved to [${i.name}/${entry}], which does not have the .ts extension`,
						)
					}
					// if entry, use unpkg, if no entry, use esmsh
					i.resultTarget = entry ? i.dep.unpkg + '/' + entry : i.dep.esmsh
				} else {
					// not installed, use npm: prefix
					i.resultTarget = `npm:${i.name}`
				}
			}
		}

		// default result target
		if (i.resultTarget == null) {
			i.resultTarget = i.sourceTarget
		}

		// continue
		file.imports.push(i)
	}

	// perform the replacements
	let result = file.source
	let offset = 0
	for (const i of file.imports) {
		i.label = `${i.type} import of [${i.sourceTarget}] => [${i.resultTarget}]`
		if (i.resultTarget == null) {
			// no modification necessary
			continue
		}
		const cursor = i.sourceIndex + offset
		const replacement = replaceImportStatement(
			i.sourceStatement,
			i.sourceTarget,
			i.resultTarget,
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
			`import filedirname from '${
				details.deps.filedirname?.esmsh || 'npm:filedirname'
			};\n` +
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
	const pkg: any = await readJSON(pkgPath).catch((err: any) =>
		Promise.reject(new Errlop('require package.json file to be present', err)),
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
				'refer to https://github.com/bevry/make-deno-edition and https://editions.bevry.me for details',
		)
	}

	// get the source edition path
	const sourceEditionPath = join(cwd, sourceEdition.directory)

	// get the deno entry
	const denoEntry = (await isReadable(join(sourceEditionPath, 'deno.ts')))
		? 'deno.ts'
		: sourceEdition.entry

	// get the source edition files
	const paths = (await list(sourceEditionPath))
		.filter((path) => path.endsWith('.ts'))
		.map((path) => join(sourceEditionPath, path))

	// delete the old files
	await remove(denoEditionPath)

	// prepare details
	const details: Details = {
		files: {},
		deps: {},
		success: true,
	}

	// add the dependencies
	for (const [name, version] of Object.entries(
		Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {}),
	)) {
		if (details.deps[name]) {
			throw new Error(`[${name}] dependency is duplicated`)
		} else {
			const dep: Dependency = {
				name,
				version: version as string,
				denoEntry: null,
				unpkg: `https://unpkg.com/${name}@${version}`, // compatible with entries, as entire package is available
				esmsh: `https://esm.sh/${name}@${version}`, // only supports deno entries it seems
				errors: new Set<string>(),
			}

			const path = join(nm, name, 'package.json')
			try {
				const pkg: any = await readJSON(path)
				dep.denoEntry = pkg?.deno || null
			} catch (err) {
				// don't change success, as this dependency may not be actually be used
				dep.errors.add(
					`dependency [${name}] does not appear installed, as [${path}] was not valid JSON, install the dependency and try again`,
				)
			}

			details.deps[dep.name] = dep
		}
	}

	// add the files
	await Promise.all(
		paths.map(async (path) => {
			const filename = path.replace(sourceEditionPath + sep, '')
			const source = await readFile(path)
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
		}),
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
						`import of dependency [${i.dep.name}] has incompatibilities`,
					)
				// bubble file import errors
				if (i.file?.errors.size)
					i.errors.add(
						`import of local file [${i.sourceTarget}] has incompatibilities`,
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
				await writeFile(file.denoPath, file.result)
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
			} catch (err: any) {
				file.errors.add(
					`running deno on the file failed:\n\tdeno ${args.join(' ')}\n\t` +
						String(err.stderr).replace(/\n/g, '\n\t'),
				)
				if (file.errors.size && file.necessary) {
					details.success = false
				}
			}
		}
	}

	// delete deno edition entry, will be re-added later if it is suitable
	pkg.editions = pkg.editions.filter(
		(e: any) => e.directory !== denoEditionDirectory,
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
