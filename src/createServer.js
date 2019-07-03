const { GraphQLServer } = require('graphql-yoga')
//
const Mutation = require('./resolvers/Mutation')
const Query = require('./resolvers/Query')
//
const Post = require('./resolvers/Post')
const User = require('./resolvers/User')
const PollOption = require('./resolvers/PollOption')
//
const db = require('./db')

// Create the GraphQL Yoga Server

function createServer() {
	return new GraphQLServer({
		typeDefs: 'src/schema.graphql',
		resolvers: {
			Mutation,
			Query,
			Post,
			User,
			PollOption
		},
		resolverValidationOptions: {
			requireResolversForResolveType: false
		},
		context: req => ({ ...req, db })
	})
}

module.exports = createServer
