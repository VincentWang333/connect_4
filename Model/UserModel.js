const mongoose = require("mongoose");
const Schema = mongoose.Schema;


let userSchema = Schema({
    profile_privacy: {type: Boolean, default: false},
    username: {type: String, required: true},
    password: {type: String, required: true},
    friendlist: [{type: String}],
    friend_request_recieved_list: [{type: Schema.Types.ObjectId, ref: 'FriendRequest'}],
    friend_request_send_list: [{type: Schema.Types.ObjectId, ref: 'FriendRequest'}],
    games: [{type: Schema.Types.ObjectId, ref: 'GameRecord'}],
});

module.exports = mongoose.model("User", userSchema);