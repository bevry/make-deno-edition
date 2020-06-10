import getArg from 'get-cli-arg'

import { make } from './index.js'
import * as log from './log.js'

async function bin() {
	try {
		await make()
		log.success('OK!')
		log.success('deno edition created successfully')
	} catch (err) {
		if (getArg('attempt')) {
			// ignore failure
			log.special('FAILURE!')
			log.special(err)
		} else {
			log.error('FAILURE!')
			log.error(err)
			process.exitCode = 1
		}
	}
}

bin()
