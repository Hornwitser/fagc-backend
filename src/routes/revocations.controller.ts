import { FastifyReply, FastifyRequest } from "fastify"
import { Controller, GET } from "fastify-decorators"
import { Type } from "@sinclair/typebox"

import RevocationModel from "../database/fagc/revocation.js"

@Controller({ route: "/revocations" })
export default class ProfileController {
	@GET({
		url: "/community/:playername/:communityId",
		options: {
			schema: {
				params: Type.Required(
					Type.Object({
						playername: Type.String(),
						communityId: Type.String(),
					})
				),

				description: "Fetch all revocations of a player in a community",
				tags: [ "revocation" ],
				response: {
					"200": {
						type: "array",
						items: {
							$ref: "RevocationClass#",
						},
					},
				},
			},
		},
	})
	async fetchCommunity(
		req: FastifyRequest<{
			Params: {
				playername: string
				communityId: string
			}
		}>,
		res: FastifyReply
	): Promise<FastifyReply> {
		const { playername, communityId } = req.params

		const revocations = await RevocationModel.find({
			playername: playername,
			communityId: communityId,
		})
		return res.send(revocations)
	}
	@GET({
		url: "/player/:playername",
		options: {
			schema: {
				params: Type.Required(
					Type.Object({
						playername: Type.String(),
					})
				),

				description: "Fetch all revocations of a player",
				tags: [ "revocation" ],
				response: {
					"200": {
						type: "array",
						items: {
							$ref: "RevocationClass#",
						},
					},
				},
			},
		},
	})
	async fetchPlayer(
		req: FastifyRequest<{
			Params: {
				playername: string
			}
		}>,
		res: FastifyReply
	): Promise<FastifyReply> {
		const { playername } = req.params

		const revocations = await RevocationModel.find({
			playername: playername,
		})
		return res.send(revocations)
	}

	@GET({
		url: "/modifiedSince/:timestamp",
		options: {
			schema: {
				params: Type.Required(
					Type.Object({
						timestamp: Type.String(),
					})
				),

				description:
					"Fetch all revocations of a player modified since a timestamp",
				tags: [ "revocation" ],
				response: {
					"200": {
						type: "array",
						items: {
							$ref: "RevocationClass#",
						},
					},
				},
			},
		},
	})
	async getModifiedSince(
		req: FastifyRequest<{
			Params: {
				timestamp: string
			}
		}>,
		res: FastifyReply
	): Promise<FastifyReply> {
		const { timestamp } = req.params

		const date = new Date(timestamp)

		const revocations = await RevocationModel.find({
			createdAt: { $gt: date },
		})
		return res.send(revocations)
	}
}
