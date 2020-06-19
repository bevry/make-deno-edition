import getArg from 'get-cli-arg'

import { make } from './index.js'
import * as log from './log.js'

async function bin() {
	try {
		const details = await make()
		if (details.errors.size === 0) {
			log.success(
				'make-deno-edition: SUCCESS! The deno edition was created successfully, without any errors.'
			)
			if (details.warnings.size) {
				log.warn('The following warnings did occur though:')
				log.details(details.warnings)
			}
		} else if (getArg('attempt')) {
			// ignore failure
			log.special('make-deno-edition: OK!')
			log.log(
				'The optional deno edition could not be created.\n' +
					'For details, run make-deno-edition without the --atempt flag.'
			)
		} else {
			log.error('make-deno-edition: FAILURE! Could make the deno edition.')
			log.error('The following errors must be addressed:')
			log.details(details.errors)
			if (details.warnings.size) {
				log.warn('The following warnings occured:')
				log.details(details.warnings)
			}
			process.exitCode = 1
		}
		if (getArg('verbose')) log.details(details)
	} catch (err) {
		log.error(
			'make-deno-edition: UNEXEPCTED FAILURE! Could not create the deno edition, due to this unexpected error:'
		)
		log.details(err)
		process.exitCode = 1
	}
}

bin()
