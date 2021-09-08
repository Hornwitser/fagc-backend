import { WebhookClient, MessageEmbed, User } from "discord.js"
import WebhookSchema from "../database/fagc/webhook.js"
import WebSocket from "ws"
import ENV from "./env.js"
import GuildConfigModel, { ConfigClass } from "../database/bot/community.js"
import { RevocationClass } from "../database/fagc/revocation.js"
import { DocumentType } from "@typegoose/typegoose"
import { BeAnObject } from "@typegoose/typegoose/lib/types"
import { RuleClass } from "../database/fagc/rule.js"
import { CommunityClass } from "../database/fagc/community.js"
import { ReportClass } from "../database/fagc/report.js"

const wss = new WebSocket.Server({ port: ENV.WS_PORT })

const WebhookGuildIDs = new WeakMap<WebSocket, string>()

let WebhookQueue: MessageEmbed[] = []

async function SendWebhookMessages() {
	const embeds = WebhookQueue.slice(0, 10)
	if (!embeds[0]) return
	WebhookQueue = WebhookQueue.slice(10)
	const webhooks = await WebhookSchema.find()
	webhooks.forEach(async (webhook) => {
		const client = new WebhookClient({
			id: webhook.id,
			token: webhook.token
		})
		client.send({ embeds: embeds, username: "FAGC Notifier" }).catch((error) => {
			if (error.stack.includes("Unknown Webhook")) {
				console.log(`Unknown webhook ${webhook.id} with token ${webhook.token}. GID ${webhook.guildId}. Removing webhook from database.`)
				WebhookSchema.findByIdAndDelete(webhook._id).exec()
			}
			else throw error
		})
	})
}
setInterval(SendWebhookMessages, 5000)

export function WebhookMessage(message: MessageEmbed): void {
	WebhookQueue.push(message)
}

wss.on("connection", (ws) => {
	ws.on("message", async (msg) => {
		const message = JSON.parse(msg.toString("utf-8"))
		if (message.guildId) {
			const guildConfig = await GuildConfigModel.findOne({ guildId: message.guildId }).then((c) => c?.toObject())
			if (guildConfig) ws.send(Buffer.from(JSON.stringify({
				...guildConfig,
				messageType: "guildConfig"
			})))
			WebhookGuildIDs.set(ws, message.guildId)
		}
	})
})

export function WebsocketMessage(message: string): void {
	wss.clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(message)
		}
	})
}

export async function reportCreatedMessage(report: DocumentType<ReportClass, BeAnObject>, community: CommunityClass, admin: User): Promise<void> {
	if (report === null || report.playername === undefined) return

	// set the sent object's messageType to report
	WebsocketMessage(JSON.stringify(Object.assign({}, report.toObject(), { messageType: "report" })))

	const reportEmbed = new MessageEmbed()
		.setTitle("FAGC Notifications")
		.setDescription(`${report.automated ? "Automated " : ""}Report Created: \`${report.id}\` at <t:${Math.round(report.reportedTime.valueOf()/1000)}>`)
		.setColor("ORANGE")
		.addFields(
			{ name: "Playername", value: report.playername, inline: true },
			{ name: "Broken Rule", value: report.brokenRule, inline: true },
			{ name: "Admin", value: `<@${admin.id}> | ${admin.tag}`, inline: true },
			{ name: "Community", value: `${community.name} (\`${community.id}\`)`, inline: true },
			{ name: "Description", value: report.description, inline: false },
			{ name: "Proof", value: report.proof, inline: true },
		)
		.setTimestamp()
	WebhookMessage(reportEmbed)
}
export async function reportRevokedMessage(revocation: DocumentType<RevocationClass, BeAnObject>, community: CommunityClass, admin: User, revokedBy: User): Promise<void> {
	if (revocation === null || revocation.playername === undefined) return

	// set the sent object's messageType to revocation
	WebsocketMessage(JSON.stringify(Object.assign({}, revocation.toObject(), { messageType: "revocation" })))
	const revocationEmbed = new MessageEmbed()
		.setTitle("FAGC Notifications")
		.setDescription(`${revocation.automated ? "Automated " : ""}Report Revoked (\`${revocation.reportId}\`): \`${revocation.id}\` at <t:${Math.round(revocation.revokedTime.valueOf()/1000)}>`)
		.setColor("ORANGE")
		.addFields([
			{ name: "Playername", value: revocation.playername, inline: true },
			{ name: "Broken Rule", value: revocation.brokenRule, inline: true },
			{ name: "Admin", value: `<@${admin.id}> | ${admin.tag}`, inline: true },
			{ name: "Community", value: `${community.name} (\`${community.id}\`)`, inline: true },
			{ name: "Revoked by", value: `<@${revokedBy.id}> | ${revokedBy.tag}`, inline: true },
			{ name: "Description", value: revocation.description, inline: false },
			{ name: "Proof", value: revocation.proof, inline: true },
		])
		.setTimestamp()
	WebhookMessage(revocationEmbed)
}

export async function ruleCreatedMessage(rule: DocumentType<RuleClass, BeAnObject>): Promise<void> {
	if (rule === null || rule.shortdesc === undefined || rule.longdesc === undefined) return

	// set the sent object's messageType to ruleCreated
	WebsocketMessage(JSON.stringify(Object.assign({}, rule.toObject(), { messageType: "ruleCreated" })))
	const ruleEmbed = new MessageEmbed()
		.setTitle("FAGC Notifications")
		.setDescription("Rule created")
		.setColor("ORANGE")
		.addFields(
			{ name: "Rule ID", value: `\`${rule.id}\``, inline: true },
			{ name: "Rule short description", value: rule.shortdesc, inline: true },
			{ name: "Rule long description", value: rule.longdesc, inline: true },
		)
	WebhookMessage(ruleEmbed)
}

export async function ruleRemovedMessage(rule: DocumentType<RuleClass, BeAnObject>): Promise<void> {
	if (rule === null || rule.shortdesc === undefined || rule.longdesc === undefined) return
	// set the sent object's messageType to ruleRemoved
	WebsocketMessage(JSON.stringify(Object.assign({}, rule.toObject(), { messageType: "ruleRemoved" })))
	const ruleEmbed = new MessageEmbed()
		.setTitle("FAGC Notifications")
		.setDescription("Rule removed")
		.setColor("ORANGE")
		.addFields(
			{ name: "Rule ID", value: `\`${rule.id}\``, inline: true },
			{ name: "Rule short description", value: rule.shortdesc, inline: true },
			{ name: "Rule long description", value: rule.longdesc, inline: true },
		)
	WebhookMessage(ruleEmbed)
}


export async function communityCreatedMessage(community: DocumentType<CommunityClass, BeAnObject>, contact: User): Promise<void> {
	// set the sent object's messageType to communityCreated
	WebsocketMessage(JSON.stringify(Object.assign({}, community.toObject(), { messageType: "communityCreated" })))
	const embed = new MessageEmbed()
		.setTitle("FAGC Notifications")
		.setDescription("Community created")
		.setColor("ORANGE")
		.addFields(
			{ name: "Community ID", value: `\`${community.id}\``, inline: true },
			{ name: "Community name", value: community.name, inline: true },
			{ name: "Contact", value: `<@${contact.id}> | ${contact.tag}`, inline: true },
		)
	WebhookMessage(embed)
}
export async function communityRemovedMessage(community: DocumentType<CommunityClass, BeAnObject>, contact: User): Promise<void> {
	// set the sent object's messageType to communityRemoved
	WebsocketMessage(JSON.stringify(Object.assign({}, community.toObject(), { messageType: "communityRemoved" })))
	const embed = new MessageEmbed()
		.setTitle("FAGC Notifications")
		.setDescription("Community removed")
		.setColor("ORANGE")
		.addFields(
			{ name: "Community ID", value: `\`${community.id}\``, inline: true },
			{ name: "Community name", value: community.name, inline: true },
			{ name: "Contact", value: `<@${contact.id}> | ${contact.tag}`, inline: true },
		)
	WebhookMessage(embed)
}
export function communityConfigChanged(config: DocumentType<ConfigClass, BeAnObject>): void {
	wss.clients.forEach(client => {
		// TODO: test this
		const guildId = WebhookGuildIDs.get(client)
		if (guildId == config.guildId) {
			client.send(Buffer.from(JSON.stringify({
				...config,
				messageType: "guildConfig"
			})))
		}
	})
}

wss.on("connection", () => {
	console.log("new WebSocket connection!")
})
wss.on("listening", () => {
	console.log("Websocket listening!")
})