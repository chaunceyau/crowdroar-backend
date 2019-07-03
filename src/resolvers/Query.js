const { forwardTo } = require('prisma-binding')

const Query = {
	entities: forwardTo('db'),
	// probably should protect user query
	entity: forwardTo('db'),
	vote: forwardTo('db'),
	user: forwardTo('db'),
	posts: forwardTo('db'),
	tags: forwardTo('db'),
	comments: forwardTo('db'),
	worldCupItemCategories: forwardTo('db'),
	async popularEntities(parent, args, ctx, info) {
		const results = await ctx.db.query.entities({ where: { type: args.entity_type }, first: 10 })
		return results
	},
	async usernameExists(parent, args, ctx, info) {
		const username = await ctx.db.query.user({ where: { username: args.username.toLowerCase() } })

		if (username)
			return true

		return false
	},
	async entitySearch(parent, args, ctx, info) {
		console.log("ENTITY SEARHCING")
		// get results from lowercase search
		const results = await ctx.db.query.entitySearchIndexes(
			{
				where: {
					OR: [
						{ title_contains: args.keyword.toLowerCase() },
						{ description_contains: args.keyword.toLowerCase() }
					]
				},
				first: 5
			},
			` { id title description entity { id }  }`
		)

		// convert these results to real entities to return, rather than the index table
		const realResults = results.map(async entitySearchIndex => {
			const realEntity = await ctx.db.query.entity({ where: { id: entitySearchIndex.entity.id } }, info)
			return realEntity
		})

		return realResults
	},

	async currentUser(parent, args, ctx, info) {
		if (!ctx.request.user) return null
		return await ctx.db.query.user({ where: { id: ctx.request.user.id } }, info)
		// return { id: ctx.request.user.id }
	},
	// async currentUserProfile() {},
	async users(parent, args, ctx, info) {
		// 1. Check if they are logged in
		if (!ctx.request.user) throw new Error('You must be logged in!')

		return ctx.db.query.users({}, info)
	},

	async post(parent, args, ctx, info) {
		const post = await ctx.db.query.post({}, info)

		if (!post) throw new Error('This post could not be found.')

		return post
	},

	async entityPosts(parent, args, ctx, info) {
		const posts = await ctx.db.query.posts(
			{
				where: { entity: { id: args.id } },
				orderBy: 'upvote_count_DESC',
				first: args.first,
				skip: args.skip
			},
			info
		)

		return posts
	},

	async feedPosts(parent, args, ctx, info) {
		const posts = await ctx.db.query.posts({
			orderBy: 'upvote_count_DESC',
			first: args.first,
			skip: args.skip
		}, info)

		console.log('feed post query')
		return posts
	}
}

module.exports = Query
