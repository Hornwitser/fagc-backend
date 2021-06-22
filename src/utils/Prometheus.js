// Clone from https://github.com/DistroByte/AwF-Bot/blob/master/base/Prometheus.js

const promClient = require("prom-client")
const http = require("http")
const config = require("../../config")
const ConfigModel = require("../database/bot/community")
const CommunityModel = require("../database/fagc/community")
const RuleModel = require("../database/fagc/rule")

const collectDefaultMetrics = promClient.collectDefaultMetrics
const Registry = promClient.Registry
const register = new Registry()
collectDefaultMetrics({ register })

const communityGauge = new promClient.Gauge({
	name: "community_trust_count",
	help: "Amount of communities that trust this community",
	labelNames: ["id", "name", "contact"]
})
const ruleGauge = new promClient.Gauge({
	name: "rule_trust_count",
	help: "Amount of communities that trust this rule",
	labelNames: ["id", "shortdesc"]
})

register.registerMetric(communityGauge)
register.registerMetric(ruleGauge)

// Format community trust from config
const trustedCommunities = async (communities) => {
	let rawResults = []
	const CachedCommunities = new Map()
	const getOrFetchCommunity = async (communityId) => {
		const cachedCommunity = CachedCommunities.get(communityId)
		if (cachedCommunity) return cachedCommunity
		const community = CachedCommunities.set(communityId, CommunityModel.findOne({id: communityId})).get(communityId)
		return community
	}
	communities.forEach((community) => {
		community.trustedCommunities.forEach((communityId) => {
			let found = false
			rawResults.forEach((trusted) => {
				if (trusted.id === communityId) {
					trusted.count++
					found = true
				}
			})
			if (!found) {
				rawResults.push({ id: communityId, count: 1 })
			}
		})
	})
	let results = rawResults.map(async (community) => {
		return {
			community: await getOrFetchCommunity(community.id),
			count: community.count
		}
	})
	return await Promise.all(results)
}
// Format rule trust from config
const trustedRules = async (communities) => {
	let rawResults = []
	const CachedRules = new Map()
	const getOrFetchRule = async (ruleid) => {
		const cachedRule = CachedRules.get(ruleid)
		if (cachedRule) return cachedRule
		const rule = CachedRules.set(ruleid, RuleModel.findOne({id: ruleid})).get(ruleid)
		return rule
	}
	communities.forEach((community) => {
		community.ruleFilters.forEach((ruleID) => {
			let found = false
			rawResults.forEach((trusted) => {
				if (trusted.id === ruleID) {
					trusted.count++
					found = true
				}
			})
			if (!found) {
				rawResults.push({ id: ruleID, count: 1 })
			}
		})
	})
	let results = rawResults.map(async (rule) => {
		return {
			rule: await getOrFetchRule(rule.id),
			count: rule.count
		}
	})
	return await Promise.all(results)
}

// collect statistics and put them to the server
const collectStatistics = async () => {
	let communitySettings = await ConfigModel.find({})
		.then((configs) => configs.map((CommunityConfig) => CommunityConfig.toObject()))
		.then((configs) => configs.map((CommunityConfig) => { delete CommunityConfig.apikey; return CommunityConfig }))
	let rules = await trustedRules(communitySettings)
	let communities = await trustedCommunities(communitySettings)

	rules.forEach((rule) => {
		if (rule.rule)
			ruleGauge.set({ id: rule.rule.id, shortdesc: rule.rule.shortdesc }, rule.count)
	})
	communities.forEach((community) => {
		if (!community.community || !community.community.id) return
		communityGauge.set({
			id: community.community.id,
			name: community.community.name,
			contact: community.community.contact
		}, community.count)
	})
}

setInterval(async () => {
	collectStatistics()
}, 3600 * 1000 * 3) // collect every 3 hours (3*3600*1000)
collectStatistics() // initial statistics collection



// Server for data collection
http.createServer(async (req, res) => {
	if (req.url.endsWith("/metrics")) {
		return res.end(await register.metrics())
	}
}).listen(config.promPort)

module.exports = {
	promClient,
	register,
}