const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const jwkToPem = require('jwk-to-pem')
//
const db = require('./db')
const createServer = require('./createServer')
//
require('dotenv').config({ path: '.staging.env' })

//

const awsWellKnownKeys = [
	{
		alg: 'RS256',
		e: 'AQAB',
		kid: 'JMp4A3bzpyL3iTq/49+mbzFReIc2S3ptGNKmgHK8iJM=',
		kty: 'RSA',
		n:
			'hO1tnrAe1QMRhDOjxziWotP0urcCBBvWJyasthb1LsM7Z2YSUSV8VmuaSLTSwDq5gTEXHeEhunZgYM3dLs8edZ_6a7DM89-j7o0m0aYog84qwm9wgipwTxmq1Uq5R6Xd8I6jdgm2U865Fmw1OmiWrkA1QrH08j0UAcmZUzdeYl4mvhGTEAqN9pXh9BAZZHughIyVaFNh-IUdhgFHpSG6gTPCCn09LQXyIwwWT030Ug6URLkH7Le45o3T0qj2PVqOdTjoVJCijH5hH70RwwXJfnXPfJgrp4AIWUgy74nCUGJiRYWGkRZDH-_7KxHVLw3PnUi2Xq247EBI7NMbAtX0PQ',
		use: 'sig'
	},
	{
		alg: 'RS256',
		e: 'AQAB',
		kid: 'BVFbCk6NirLMHnUDavmBtOxJB656B/NtXMKvB7yzfho=',
		kty: 'RSA',
		n:
			'irjXVlXi44HF6-41hgyDLwOGNcF3kSbnn5DIotqrFuJefi-Q8tgqqKm4kg8dXtFD4I9IrUazRkykdHxWAbNSsEd3DlUWMcdYyQHxSrVnd6MeNDdGT_mzsLEdFk6bHY6KczQ-3EHvlymcD0x4o706b9pYV60tMEuzBx9lMNEXrjxbN7K4owZUlGsH-IqnGrhoIWjVt9lw1LFTHEjVuWxkd6MKPtlpR54m0tSsWNywZIWwIU24Ej2q5T0U4hUIgJBmyRvyqVBaP_gpe6HOXdRH10tDLSCvUiQzMYbj-gvanTBQvm8qUrGtS-DHTVcpsgfLjCgWqCk8LmiHwfdDMzfhsw',
		use: 'sig'
	}
]

//
const pem = jwkToPem(awsWellKnownKeys[0])
// 
const server = createServer()
// 
server.express.use(cookieParser())

// 1. decode the JWT so we can get the user Id on each request
server.express.use(async (req, res, next) => {
	// console.log("USING INDEX>JS, ", req.headers)
	const headerAuthorizationToken = await req.headers.authorization

	// console.log('authorization, ', headerAuthorizationToken)
	if (headerAuthorizationToken && headerAuthorizationToken.length > 15) {
		try {
			const { sub } = jwt.verify(headerAuthorizationToken, pem, {
				algorithms: ['RS256']
			})
			// console.log('VERIFIED : JWT', sub)
			req.user_cognito_id = sub
		} catch (err) {
			// console.log('ERROR : VERIFYING JWT', err)
			req.user = null
		}
	} else {
		// if not auth token, look for unauth token
		const unauthInfoToken = await req.headers.unauthInfoToken

		if (unauthInfoToken && unauthInfoToken > 10) {
			req.user_cognito_id = unauthInfoToken.substr(10)
		} else {
			req.user = null
		}
	}
	// console.log('past, ')

	next()
})

// 2. populate user from prisma
server.express.use(async (req, res, next) => {
	// console.log("PART 2", req.user_cognito_id)
	if (!req.user_cognito_id) {
		// console.log("PART 2. next")
		return next()
	}
	// console.log("PART 2.5")
	const user = await db.query.user({ where: { cognito_id: req.user_cognito_id } }, '{ id cognito_id }')
	// console.log("PART 2.9 USER? ", user)
	console.log("USERR, ", user)
	req.user = user
	next()
})


server.start(
	{
		cors: {
			credentials: true,
			origin: process.env.FRONTEND_URL || 'http://localhost:7777',
		}
	},
	deets => {
		console.log(`Server is now running on port http://localhost:${deets.port}`)
	}
)
