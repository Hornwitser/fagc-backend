import typegoose from "@typegoose/typegoose"
const { getModelForClass, modelOptions, pre, prop } = typegoose
import { getUserStringFromID } from "../../utils/functions-databaseless.js"

@modelOptions({
	schemaOptions: {
		collection: "reports",
	},
})
@pre<ReportClass>("save", function (next) {
	this.id = getUserStringFromID(this._id.toString())
	this.createdAt = this.createdAt || new Date()
	next()
})
export class ReportClass {
	@prop({ _id: false })
		id!: string

	@prop()
		playername!: string

	@prop()
		communityId!: string

	@prop()
		brokenRule!: string

	@prop()
		proof!: string

	@prop()
		description!: string

	@prop()
		automated!: boolean

	@prop()
		reportedTime!: Date

	@prop()
		adminId!: string

	@prop()
		createdAt!: Date
}

const ReportModel = getModelForClass(ReportClass)
export default ReportModel
