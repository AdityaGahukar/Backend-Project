import mongoose, {Schema} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {  // one who is subscribing
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    channel: {  // channel to which the user (subscriber) is subscribing
        type: Schema.Types.ObjectId,
        ref: "User",
    }
}, {timestamps: true});

export const Subscription = mongoose.model("Subscription", subscriptionSchema);