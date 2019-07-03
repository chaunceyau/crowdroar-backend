const User = {
	email(parent, args, ctx, info) {
		if (ctx.request.user && parent.id === ctx.request.user.id) return parent.email
		return null
	},
	async posts(parent, args, ctx, info) {
		return await ctx.db.query.posts({})
	}
}

module.exports = User
