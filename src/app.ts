import path from "path"
const __dirname = path.dirname(new URL(import.meta.url).pathname)

import Fastify, { FastifyInstance } from "fastify"
import fastifyCorsPlugin from "fastify-cors"
import fastifyRateLimitPlugin from "fastify-rate-limit"
import { fastifyRequestContextPlugin } from "fastify-request-context"
import fastifyHelmetPlugin from "fastify-helmet"
import { bootstrap } from "fastify-decorators"
import ENV from "./utils/env.js"
import { DocumentType, mongoose } from "@typegoose/typegoose"
import CommunityModel, { CommunityClass } from "./database/fagc/community.js"
import { BeAnObject } from "@typegoose/typegoose/lib/types"
import fastifyFormBodyPlugin from "fastify-formbody"
import { OAuth2Client } from "./utils/discord.js"
import removeIdMiddleware from "./utils/removeId.js"
import fastifyCookie from "fastify-cookie"
import fastifySession from "@mgcrea/fastify-session"
import { SODIUM_SECRETBOX } from "@mgcrea/fastify-session-sodium-crypto"
import fastifyExpress from "fastify-express"
import * as Sentry from "@sentry/node"
import * as Tracing from "@sentry/tracing"
import fastifySwagger from "fastify-swagger"
import mongooseToSwagger from "mongoose-to-swagger"
import ReportModel from "./database/fagc/report.js"
import RevocationModel from "./database/fagc/revocation.js"
import RuleModel from "./database/fagc/rule.js"
import UserModel from "./database/fagc/user.js"
import WebhookModel from "./database/fagc/webhook.js"
import GuildConfigModel from "./database/bot/community.js"

const fastify: FastifyInstance = Fastify({})

// fastify.register(sentry, {
// 	dsn:
// })
Sentry.init({
	dsn: ENV.SENTRY_LINK,

	// We recommend adjusting this value in production, or using tracesSampler
	// for finer control
	tracesSampleRate: 1.0,
	integrations: [
		new Sentry.Integrations.Http({ tracing: true }),
		new Sentry.Integrations.Console(),
	],
})

await fastify.register(fastifyExpress)
fastify.use(Sentry.Handlers.requestHandler())

const SwaggerDefinitions = {}

const swaggerDefOpts = {
	// omitFields: ["_id"],
	props: ["id"],
}
const communityModelSwagger = mongooseToSwagger(CommunityModel, swaggerDefOpts)
SwaggerDefinitions[communityModelSwagger.title] = communityModelSwagger
const ReportModelSwagger = mongooseToSwagger(ReportModel, swaggerDefOpts)
SwaggerDefinitions[ReportModelSwagger.title] = ReportModelSwagger
const RevocationModelSwagger = mongooseToSwagger(
	RevocationModel,
	swaggerDefOpts
)
SwaggerDefinitions[RevocationModelSwagger.title] = RevocationModelSwagger
const RuleModelSwagger = mongooseToSwagger(RuleModel, swaggerDefOpts)
SwaggerDefinitions[RuleModelSwagger.title] = RuleModelSwagger
const UserModelSwagger = mongooseToSwagger(UserModel, swaggerDefOpts)
SwaggerDefinitions[UserModelSwagger.title] = UserModelSwagger
const WebhookModelSwagger = mongooseToSwagger(WebhookModel, swaggerDefOpts)
SwaggerDefinitions[WebhookModelSwagger.title] = WebhookModelSwagger

// add in id because of https://github.com/giddyinc/mongoose-to-swagger/pull/33
Object.keys(SwaggerDefinitions).map((key) => {
	SwaggerDefinitions[key].properties = {
		id: { type: "string" },
		...SwaggerDefinitions[key].properties,
	}
})

const GuildConfigModelSwagger = mongooseToSwagger(
	GuildConfigModel,
	swaggerDefOpts
)
SwaggerDefinitions[GuildConfigModelSwagger.title] = GuildConfigModelSwagger

// swagger
fastify.register(fastifySwagger, {
	routePrefix: "/documentation",
	swagger: {
		info: {
			title: "FAGC Backend",
			description: "FAGC Backend",
			version: "0.1.0",
		},
		externalDocs: {
			url: "https://github.com/FactorioAntigrief/fagc-backend",
			description: "Find the repo here",
		},
		host: "localhost:3000",
		schemes: ["http"],
		consumes: ["application/json", "x-www-form-urlencoded"],
		produces: ["application/json"],
		tags: [
			{ name: "community", description: "Community related end-points" },
			{ name: "report", description: "Report related end-points" },
			{ name: "master", description: "Master API" },
		],
		definitions: SwaggerDefinitions,
		securityDefinitions: {
			apiKey: {
				type: "apiKey",
				name: "apikey",
				in: "header",
			},
		},
	},
	uiConfig: {
		docExpansion: "full",
		deepLinking: false,
	},
	uiHooks: {
		onRequest: function (request, reply, next) {
			next()
		},
		preHandler: function (request, reply, next) {
			next()
		},
	},
	staticCSP: true,
	transformStaticCSP: (header) => header,
	exposeRoute: true,
})

// cors
fastify.register(fastifyCorsPlugin, {
	origin: true, // reflect the request origin
})

// rate limiting
fastify.register(fastifyRateLimitPlugin, {
	max: 100,
	timeWindow: 1000 * 60, // 100 reqs in 60s
	allowList: ["::ffff:127.0.0.1", "::1", "127.0.0.1"],
})

// context
fastify.register(fastifyRequestContextPlugin, {
	hook: "preValidation",
	defaultStoreValues: {
		oauthclient: OAuth2Client,
	},
})
// typed context
declare module "fastify-request-context" {
	interface RequestContextData {
		community?: DocumentType<CommunityClass, BeAnObject>
		oauthclient: typeof OAuth2Client
	}
}

// helmet
fastify.register(fastifyHelmetPlugin)

// form body for backwards compat with the express api
fastify.register(fastifyFormBodyPlugin)

// middlware to remove garbage from responses
fastify.addHook("onSend", removeIdMiddleware)

// yummy snackies
fastify.register(fastifyCookie)
fastify.register(fastifySession, {
	secret: ENV.SESSIONSECRET,
	cookie: {
		maxAge: 1000 * 86400 * 365, // persist cookie for 1 year
		// httpOnly: true,
		// sameSite: "none", //
		// secure: ENV.isProd, // cookie works only in https
	},
	// cookieName: ENV.COOKIENAME,
	// saveUninitialized: true,
	crypto: SODIUM_SECRETBOX,
})

// typed session
declare module "@mgcrea/fastify-session" {
	interface SessionData {
		userId?: string
	}
}

// import secureSession from "fastify-secure-session"
// fastify.register(secureSession, {
// 	cookieName: ENV.COOKIENAME,
// 	key: ENV.SESSIONSECRET,
// })

fastify.register(bootstrap, {
	directory: path.resolve(__dirname, "routes"),
})

// fastify.register(fastifyResponseValidationPlugin)

fastify.use(Sentry.Handlers.errorHandler())

fastify.addHook("onError", (req, res, error, next) => {
	console.error(error)
	next()
})

const start = async () => {
	try {
		await fastify.listen(ENV.API_PORT)

		const address = fastify.server.address()
		const port = typeof address === "string" ? address : address?.port
		console.log(`Server listening on :${port}`)
	} catch (err) {
		console.error(err)
		process.exit(1)
	}
}
start()

fastify.ready((err) => {
	if (err) throw err
	fastify.swagger()
})

process.on("beforeExit", () => {
	fastify.close()
})

// import Fastify from "fastify"
// import fastifySwagger from "fastify-swagger"

// const fastify = Fastify()

// fastify.register(fastifySwagger, {
// 	routePrefix: "/documentation",
// 	staticCSP: true,
// 	transformStaticCSP: (header) => header,
// 	exposeRoute: true,
// })

// fastify.get("/data", async (req, res) => {
// 	res.send({ msg: "Hi." })
// })

// fastify.ready((err) => {
// 	if (err) throw err
// 	fastify.swagger()
// })
// await fastify.listen(3000)
