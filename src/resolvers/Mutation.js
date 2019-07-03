ensureSignIn = (ctx, actionString) => {
	if (!ctx.request.user) {
		throw new Error(`You must be logged in.`)
	}
}

const Mutations = {
	async createEntity(parent, args, ctx, info) {
		ensureSignIn(ctx)
		const entity = await ctx.db.mutation.createEntity(
			{
				data: {
					...args,
					verified: false
				}
			},
			info
		)

		if (!entity) throw new Error('Failed to create entity. We apologize for the inconvenience.')

		// create search instance of entity - remember to do on entity update mutations.
		// we need this as a lowercase instance to match searches from frontend.
		// prisma doesn't currently support case_insensitive search
		// e.g. (where : { title_contains_case_insensitive: "apple" }) -> won't return Apple
		await ctx.db.mutation.createEntitySearchIndex({
			data: {
				entity: { connect: { id: entity.id } },
				description: entity.description.toLowerCase(),
				title: entity.title.toLowerCase()
			}
		})
		return entity
	},

	async createUser(parent, args, ctx, info) {
		const user = await ctx.db.mutation.createUser(
			{
				data: {
					...args,
					username: args.username.toLowerCase()
				}
			},
			info
		)
		return user
	},
	async createNewTag(parent, args, ctx, info) {
		ensureSignIn(ctx)

		const tag = await ctx.db.mutation.createTag(
			{
				data: { title: args.title, entity: { connect: { id: args.entityID } } }
			},
			info
		)

		return tag
	},

	async createComment(parent, args, ctx, info) {
		ensureSignIn(ctx)
		const comment = await ctx.db.mutation.createComment(
			{
				data: {
					post: { connect: { id: args.postID } },
					content: args.content,
					author: { connect: { id: ctx.request.user.id } }
				}
			},
			info
		)
		return comment
	},

	async createSubcomment(parent, { commentID, content }, ctx, info) {
		// ensureSignIn(ctx)
		const subcomment = await ctx.db.mutation.updateComment(
			{
				data: {
					subcomments: {
						create: {
							content,
							author: { connect: { id: ctx.request.user.id } }
						}
					}
				},
				where: {
					id: commentID
				}
			},
			info
		)
		return subcomment
	},

	async createNewPost(parent, args, ctx, info) {
		ensureSignIn(ctx, 'create a new post')



		const { title, description, entityID, tags, post_type, poll_title, poll_options } = args
		if (post_type === "POLL_SELECTION") {
			if (!poll_title)
				throw new Error("To create a poll, you must provide a title.")
			if (poll_options.length < 2)
				throw new Error("To create a poll, you must provide at least 2 options.")
		}

		const post = await ctx.db.mutation.createPost(
			{
				data: {
					title,
					description,
					post_type,
					author: { connect: { id: ctx.request.user.id } },
					entity: { connect: { id: entityID } },
					tags: {
						connect: tags.map(tag => {
							return { id: tag }
						})
					}
				}
			},
			info
		)
		// create poll if post type is poll
		if (post_type === "POLL_SELECTION")
			await ctx.db.mutation.createPoll({
				data: {
					title: poll_title,
					options: { create: poll_options.map(title => { return { title: title } }) },
					post: { connect: { id: post.id } }
				}
			})
		return post
	},

	async vote(parent, { id, type }, ctx, info) {
		// ensureSignIn(ctx)

		let user_id = null
		console.log("V0TEee ", ctx.request.headers)
		// vote associated with user
		if (ctx.request.user || ctx.request.headers.unauth) {
			if (ctx.request.user) {
				user_id = ctx.request.user.id
			} else {
				// vote associated with 

				// take the substring of us-east-1: to get "sub"
				const unauth_cognito_id = ctx.request.headers.unauth.substr(10)

				const user = await ctx.db.query.user({ where: { cognito_id: unauth_cognito_id } }, `{ id }`)
				// if no anonymous user exists, we need to create one
				if (user) {
					user_id = user.id
				} else {
					const newUser = await ctx.db.mutation.createUser({ data: { cognito_id: unauth_cognito_id, anonymous: true } }, `{ id }`)

					user_id = newUser.id
				}
				console.log("FAKE USER , ", user)
			}

		} else {
			throw new Error('We experienced an issue submitting your vote. Please try refreshing the page.')
		}


		const post = await ctx.db.query.post(
			{ where: { id } },
			`
			{
				id
				title
				upvote_count
				downvote_count
				votes (where: { user: { id: "${user_id}" } }) {
					id
					type
				}
			}
			`
		)
		// 
		if (!post) throw new Error('This post does not exist.')
		// 
		if (post.votes.length > 1) console.log('MORE THAN ONE VOTE BY USER ON POST : ', post)
		// 
		if (Array.isArray(post.votes) && post.votes.length > 0) {
			const userVote = post.votes[0]
			console.log('1... ')
			if (!userVote) throw new Error('This vote no longer exists')
			// delete if same vote already exists
			if (userVote.type === type) {
				console.log('2... ')
				const deleteModifyCount =
					type === 'UPVOTE'
						? { upvote_count: post.upvote_count - 1 }
						: { downvote_count: post.downvote_count - 1 }
				const deleteData = { votes: { delete: { id: post.votes[0].id } }, ...deleteModifyCount }

				return ctx.db.mutation.updatePost({ where: { id }, data: deleteData })
			}

			console.log('3... ')
			// convert from one type of vote to other
			const convertModifyCount = {
				upvote_count: type === 'UPVOTE' ? post.upvote_count + 1 : post.upvote_count - 1,
				downvote_count: type === 'UPVOTE' ? post.downvote_count - 1 : post.downvote_count + 1
			}

			const convertData = {
				votes: { update: { where: { id: post.votes[0].id }, data: { type } } },
				...convertModifyCount
			}
			console.log('4... ')
			return ctx.db.mutation.updatePost({ where: { id }, data: convertData })
		} else {
			// create new vote if one doesn't exist
			console.log('5... ')
			const createModifyCount =
				type === 'UPVOTE'
					? { upvote_count: post.upvote_count + 1 }
					: { downvote_count: post.downvote_count + 1 }
			const createData = {
				votes: { create: { user: { connect: { id: user_id } }, type } },
				...createModifyCount
			}

			console.log('6... ', id, JSON.stringify(createData))

			return ctx.db.mutation.updatePost({ where: { id }, data: createData })
		}
	},

	async voteOnPoll(parent, { id, selected_id }, ctx, info) {
		// 1. We want to make sure the poll exists
		const poll = await ctx.db.query.poll(
			{ where: { id: id } },
			`{
				id
				options {
					id
					vote_count
				}
				total_votes
			}`
		)

		// 2. if no poll, throw error
		if (!poll) throw new Error('We could not find the poll you selected.')

		const { options } = poll

		let user_id = null

		// FIND USER TO ASSOCIATE WITH VOTE...
		if (ctx.request.user || ctx.request.headers.unauth) {
			if (ctx.request.user) {
				user_id = ctx.request.user.id
			} else {
				// vote associated with 

				// take the substring of us-east-1: to get "sub"
				const unauth_cognito_id = ctx.request.headers.unauth.substr(10)

				const user = await ctx.db.query.user({ where: { cognito_id: unauth_cognito_id } }, `{ id }`)
				// if no anonymous user exists, we need to create one
				if (user) {
					user_id = user.id
				} else {
					const newUser = await ctx.db.mutation.createUser({ data: { cognito_id: unauth_cognito_id, anonymous: true } }, `{ id }`)

					user_id = newUser.id
				}
				console.log("FAKE USER , ", user)
			}

		} else {
			throw new Error('We experienced an issue submitting your vote. Please try refreshing the page.')
		}

		// 3. We want to know if user is logged in
		// if not, vote must be registered to ip instead
		console.log("ususus : ", user_id)
		// if (ctx.request.user) {
		const existingVoteOnPoll = await ctx.db.query.pollVotes(
			{
				where: { user: { id: user_id } },
				poll: { id }
			},
			`{ id selected { id  } }`
		)
		// if user already voted, we need to remove this vote before adding a new one
		if (existingVoteOnPoll.length > 0) {
			console.log("FOUND VOTE")
			// destructure the old selected options so we know which to lower vote count on
			const { selected } = existingVoteOnPoll[0]

			//  if vote exists, delete it
			await ctx.db.mutation.deletePollVote({ where: { id: existingVoteOnPoll[0].id } })


			// map through the selected options and lower the vote_count by 1
			// selected.map(sel => {
			// find the vote count of the option with matching id
			const { vote_count } = options.find(o => {
				return o.id === selected.id
			})
			// lower vote count by 1
			ctx.db.mutation.updatePollOption({
				where: { id: selected.id },
				data: { vote_count: vote_count - 1 }
			})

			ctx.db.mutation.updatePoll({
				where: { id: id },
				data: { total_votes: poll.total_votes - 1 }
			})
			// })
		}
		// we can now create a new poll vote, connect it to the user and increment the vote count
		const newVote = await ctx.db.mutation.createPollVote(
			{
				data: {
					user: { connect: { id: user_id } },
					poll: { connect: { id } },
					selected: {
						connect: {
							id: selected_id
						}
						// connect: selected_id.map(opt => {
						// 	return { id: opt }
						// })
					}
				}
			},
			`{ id selected { id vote_count  } }`
		)

		// TODO: update vote count
		const { selected } = newVote
		// update vote count
		if (newVote) {
			ctx.db.mutation.updatePoll({
				where: { id: id },
				data: { total_votes: poll.total_votes + 1 }
			})

			await ctx.db.mutation.updatePollOption({ where: { id: selected.id }, data: { vote_count: selected.vote_count + 1 } })
		}
		return newVote
	},
	async worldCupVote(parent, { email, selected_ids }, ctx, info) {
		if (!email) {
			throw new Error('You must provide an email address.')
		}
		const email_vote = await ctx.db.query.worldCupVote({ where: { email } })

		if (email_vote !== null) {
			throw new Error('You have already voted with this email address.')
		}
		const current_items = await ctx.db.query.worldCupItems({ where: { id_in: selected_ids } }, `{ id vote_count }`)

		current_items.map(async item => {
			await ctx.db.mutation.updateWorldCupItem({ where: { id: item.id }, data: { vote_count: item.vote_count + 1 } })
		})
		await ctx.db.mutation.createWorldCupVote({ data: { email } })
		return true
	}
}

module.exports = Mutations


// 
// 
// 

//  working prior to making only one selection poll

// 
// 
// 

// async voteOnPoll(parent, { id, optionIDs }, ctx, info) {
// 	// 1. We want to make sure the poll exists
// 	const poll = await ctx.db.query.poll(
// 		{ where: { id: id } },
// 		`{
// 			id
// 			options {
// 				id
// 				vote_count
// 			}
// 		}`
// 	)

// 	// 2. if no poll, throw error
// 	if (!poll) throw new Error('We could not find the poll you selected.')

// 	const { options } = poll

// 	let user_id = null

// 	// vote associated with user
// 	if (ctx.request.user || ctx.request.headers.unauth) {
// 		if (ctx.request.user) {
// 			user_id = ctx.request.user.id
// 		} else {
// 			// vote associated with 

// 			// take the substring of us-east-1: to get "sub"
// 			const unauth_cognito_id = ctx.request.headers.unauth.substr(10)

// 			const user = await ctx.db.query.user({ where: { cognito_id: unauth_cognito_id } }, `{ id }`)
// 			// if no anonymous user exists, we need to create one
// 			if (user) {
// 				user_id = user.id
// 			} else {
// 				const newUser = await ctx.db.mutation.createUser({ data: { cognito_id: unauth_cognito_id, anonymous: true } }, `{ id }`)

// 				user_id = newUser.id
// 			}
// 			console.log("FAKE USER , ", user)
// 		}

// 	} else {
// 		throw new Error('We experienced an issue submitting your vote. Please try refreshing the page.')
// 	}

// 	// 3. We want to know if user is logged in
// 	// if not, vote must be registered to ip instead
// 	console.log("ususus : ", user_id)
// 	// if (ctx.request.user) {
// 	const existingUserTypeVoteOnPoll = await ctx.db.query.pollVotes(
// 		{
// 			where: { user: { id: user_id } },
// 			poll: { id }
// 		},
// 		`{ id selected { id } }`
// 	)
// 	// if user already voted, we need to remove this vote before adding a new one
// 	if (existingUserTypeVoteOnPoll.length > 0) {
// 		console.log("FOUND VOTE")
// 		//  if vote exists, delete it
// 		await ctx.db.mutation.deletePollVote({ where: { id: existingUserTypeVoteOnPoll[0].id } })

// 		// destructure the old selected options so we know which to lower vote count on
// 		const { selected } = existingUserTypeVoteOnPoll[0]

// 		// map through the selected options and lower the vote_count by 1
// 		selected.map(sel => {
// 			// find the vote count of the option with matching id
// 			const { vote_count } = options.find(o => o.id === sel.id)
// 			// lower vote count by 1
// 			ctx.db.mutation.updatePollOption({
// 				where: { id: sel.id },
// 				data: { vote_count: vote_count - 1 }
// 			})
// 		})
// 	}

// 	// we can now create a new poll vote, connect it to the user and increment the vote count
// 	const newVote = await ctx.db.mutation.createPollVote(
// 		{
// 			data: {
// 				user: { connect: { id: user_id } },
// 				poll: { connect: { id } },
// 				selected: {
// 					connect: optionIDs.map(opt => {
// 						return { id: opt }
// 					})
// 				}
// 			}
// 		},
// 		`{ id selected { id vote_count } }`
// 	)
// 	// TODO: update vote count
// 	const { selected } = newVote
// 	// update vote count
// 	selected.map(m =>
// 		ctx.db.mutation.updatePollOption({ where: { id: m.id }, data: { vote_count: m.vote_count + 1 } })
// 	)
// 	return newVote
// }