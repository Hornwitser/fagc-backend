import typegoose from "@typegoose/typegoose"
const { getModelForClass, modelOptions, pre, prop } = typegoose
import { getUserStringFromID } from "../../utils/functions-databaseless.js"

@modelOptions({
	schemaOptions: {
		collection: "communities",
	},
})
@pre<CommunityClass>("save", function (next) {
	this.id = getUserStringFromID(this._id.toString())
	next()
})
export class CommunityClass {
	@prop({ _id: false })
		id!: string

	@prop()
		name!: string

	@prop()
		contact!: string

	@prop({ type: [ String ] })
		guildIds!: string[]
}

const CommunityModel = getModelForClass(CommunityClass)
export default CommunityModel
