import getArg from 'get-cli-arg'

import { make, inform } from './index.js'
import * as color from './color.js'

async function bin() {
	const verbose = getArg('verbose') || Boolean(process.env.TRAVIS_BUILD_WEB_URL)
	const attempt = getArg('attempt')
	try {
		const details = await make()
		if (details.success) {
			console.log(color.success('make-deno-edition: SUCCESS!'))
			console.log(
				`\nThe deno edition was ${color.success(
					'created successfully'
				)}, without any errors:`
			)
			inform(details, verbose)
		} else if (attempt) {
			// ignore failure
			console.log(color.special('make-deno-edition: OK!'))
			console.log(
				`\nThe ${color.special('optional')} deno edition ${color.warn(
					'could not be created'
				)} for the following reasons:`
			)
			inform(details, verbose)
		} else {
			console.log(color.error('make-deno-edition: FAILURE!'))
			console.log(
				`\nThe required deno edition ${color.error(
					'could not be created'
				)} for the following reasons:`
			)
			inform(details, true)
			process.exitCode = 1
		}
	} catch (err) {
		console.log(color.error('make-deno-edition: UNEXEPCTED FAILURE!'))
		console.log(
			`\nUnable to make the deno edition, due to ${color.error(
				'this unexpected error'
			)}:`
		)
		console.log(color.inspect(err))
		process.exitCode = 1
	}
}

bin()
