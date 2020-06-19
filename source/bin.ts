import getArg from 'get-cli-arg'

import { make, inform } from './index.js'
import * as color from './color.js'

async function bin() {
	try {
		const details = await make()
		if (details.success) {
			console.log(
				color.success(
					'make-deno-edition: SUCCESS! The deno edition was created successfully, without any errors.'
				)
			)
			inform(details, !getArg('attempt'))
		} else if (getArg('attempt')) {
			// ignore failure
			console.log(color.special('make-deno-edition: OK!'))
			console.log(
				'The optional deno edition could not be created.\n' +
					'For details, run make-deno-edition without the --atempt flag.'
			)
		} else {
			console.log(
				color.error(
					'make-deno-edition: FAILURE! Unable to make the deno edition.'
				)
			)
			inform(details, true)
			process.exitCode = 1
		}
	} catch (err) {
		console.log(
			color.error(
				'make-deno-edition: UNEXEPCTED FAILURE! Unable to make the deno edition, due to this unexpected error:'
			)
		)
		process.exitCode = 1
	}
}

bin()
