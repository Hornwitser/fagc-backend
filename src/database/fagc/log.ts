import { getUserStringFromID } from "../../utils/functions-databaseless.js"
import typegoose from "@typegoose/typegoose"
const { getModelForClass, modelOptions, pre, prop } = typegoose


@modelOptions({
	schemaOptions: {
		collection: "logs",
	},
	options: {
		allowMixed: 0, // allow mixed types
	},
})
@pre<LogClass>("save", function (next) {
	this.id = getUserStringFromID(this._id.toString())
	next()
})
export class LogClass {
	@prop({ _id: false, type: String })
		id!: string

	@prop()
		timestamp!: Date

	@prop()
		apikey: string | undefined

	@prop({ type: String })
		ip: string | undefined

	@prop()
		responseBody!: unknown

	@prop()
		requestBody!: unknown

	@prop()
		endpointAddress!: string
}
const LogModel = getModelForClass(LogClass)
export default LogModel
