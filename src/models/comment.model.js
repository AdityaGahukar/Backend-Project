import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema({
    content: {
        type: String,
        required: true,
    },
    video: {  // video on which the comment is made
        type: Schema.Types.ObjectId,
        ref: "Video",
        required: true,
    },
    owner: {  // user who made the comment
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
}, {timestamps: true});

commentSchema.plugin(mongooseAggregatePaginate);
export const Comment = mongoose.model("Comment", commentSchema);