const PollOption = {
    async current_user_voted(parent, args, ctx, info) {
        // console.log('args0 ', args)
        // console.log('parent0 ', parent)
        const { poll } = parent
        if (!poll) return false
        const { id } = poll
        if (ctx.request.user) {
            // console.log("USER - POLL OPTION")
            const voteOnPoll = await ctx.db.query.pollVotes({
                where: { user: { id: ctx.request.user.id }, poll: { id }, selected: { id: parent.id } }
            })
            if (voteOnPoll.length > 0) {
                return true
            }
        } else if (ctx.request.headers.unauth) {
            // console.log("UNAUTH - POLL OPTION")

            const unauth_user = await ctx.db.query.user({ where: { cognito_id: ctx.request.headers.unauth.substr(10) } }, `{ id }`)

            // if not user, they couldn't have voted...
            if (!unauth_user) return false

            const voteOnPoll = await ctx.db.query.pollVotes({
                where: { user: { id: unauth_user.id }, poll: { id }, selected: { id: parent.id } }
            })
            if (voteOnPoll.length > 0) {
                // console.log("VOTESONPOLL ", voteOnPoll)

                return true
            }
        } else {
            // console.log("NO UNAUTH INFO")
        }

        // console.log(" - POLL OPTION")

        return false
    }
}

module.exports = PollOption
