// This file connects to the remote prisma DB and gives us the ability to query it with JS
const { Prisma } = require('prisma-binding')

const db = new Prisma({
	typeDefs: 'src/generated/prisma.graphql',
	endpoint: process.env.PRISMA_ENDPOINT || 'https://crowdroar-prisma-dbecb11364.herokuapp.com/crowdroar-backend/dev',
	// secret: process.env.PRISMA_SECRET,
	// secret: 'uf;B=u9~aG!*J*WNDn3uZv6',
	debug: false
})

module.exports = db
