const Post = {
	async current_user_downvoted({ id }, args, ctx, info) {
		if (ctx.request.user) {
			return ctx.db.exists.Vote({
				AND: [{ user: { id: ctx.request.user.id } }, { post: { id } }, { type: 'DOWNVOTE' }]
			})
		} else if (ctx.request.headers.unauth) {

			const vote = await ctx.db.exists.Vote({
				AND: [{ user: { cognito_id: ctx.request.headers.unauth.substr(10) } }, { post: { id } }, { type: 'DOWNVOTE' }]
			})

			return vote
		} else
			return false
	},
	async current_user_upvoted({ id }, args, ctx, info) {
		if (ctx.request.user) {
			return ctx.db.exists.Vote({
				AND: [{ user: { id: ctx.request.user.id } }, { post: { id } }, { type: 'UPVOTE' }]
			})
		} else if (ctx.request.headers.unauth && ctx.request.headers.unauth !== 'undefined') {
			// const user = await ctx.db.query.user({ where: { cognito_id: ctx.request.headers.unauth.substr(10) } }, `{ id }`)
			// if (!user) return false
			const vote = await ctx.db.exists.Vote({
				AND: [{ user: { cognito_id: ctx.request.headers.unauth.substr(10) } }, { post: { id } }, { type: 'UPVOTE' }]
			})
			return vote
		}
		return false
	}
	// async comments(){}
}

module.exports = Post
