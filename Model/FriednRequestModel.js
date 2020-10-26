const mongoose = require("mongoose");
const Schema = mongoose.Schema;


let FriendRequestSchema = Schema({
    requester: {
        type: String,
        required: true
    },
    recipient: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model("FriendRequest", FriendRequestSchema);