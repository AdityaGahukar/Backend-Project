import mongoose, {Schema} from "mongoose";

const likeSchema = new Schema({
    likedBy: {  // user who liked the video
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    video: {  // video which is liked
        type: Schema.Types.ObjectId,
        ref: "Video",
    },
    comment: {  // comment which is liked
        type: Schema.Types.ObjectId,
        ref: "Comment",
    },
    tweet: {   // tweet which is liked
        type: Schema.Types.ObjectId,
        ref: "Tweet",
    }
}, {timestamps: true});

export const Like = mongoose.model("Like", likeSchema);