const database = require("../database")
const connection = database.connections.find((connection) => connection.n === "fagc").c

const WebhookSchema = new connection.Schema({
    id: String,
    token: String,
    guildid: String,
})

module.exports = connection.model('webhooks', WebhookSchema)