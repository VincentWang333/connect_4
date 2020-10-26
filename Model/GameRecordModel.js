const mongoose = require("mongoose");
const Schema = mongoose.Schema;


let GameRecordSchema = Schema({
    players: [{type: String, required: true}],
    winner: String,
    playout: []
});

module.exports = mongoose.model("GameRecord", GameRecordSchema);