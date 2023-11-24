import getArg from 'get-cli-arg'

import { make, inform } from './index.js'
import * as color from './color.js'

async function bin() {
	const travis = Boolean(process.env.TRAVIS_BUILD_WEB_URL)
	const run = (getArg('run') as boolean) ?? !travis
	const verbose = getArg('verbose') as boolean
	const attempt = getArg('attempt') as boolean
	try {
		const details = await make({ run })
		if (details.success) {
			console.log(color.success('make-deno-edition: SUCCESS!'))
			console.log(
				`\nThe deno edition was ${color.success(
					'created successfully',
				)}, without any errors:`,
			)
			inform(details, verbose ?? travis)
		} else if (attempt) {
			// ignore failure
			console.log(color.special('make-deno-edition: OK!'))
			console.log(
				`\nThe ${color.special('optional')} deno edition ${color.warn(
					'could not be created',
				)} for the following reasons:`,
			)
			inform(details, verbose ?? travis)
		} else {
			console.log(color.error('make-deno-edition: FAILURE!'))
			console.log(
				`\nThe required deno edition ${color.error(
					'could not be created',
				)} for the following reasons:`,
			)
			inform(details, verbose ?? true)
			process.exitCode = 1
		}
	} catch (err: any) {
		console.log(color.error('make-deno-edition: UNEXEPCTED FAILURE!'))
		console.log(
			`\nUnable to make the deno edition, due to ${color.error(
				'this unexpected error',
			)}:`,
		)
		console.log(color.inspect(err))
		process.exitCode = 1
	}
}

bin()
