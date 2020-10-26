const express = require('express');
const mongoose = require("mongoose");
var sharedsession = require("express-socket.io-session");
const User = require("./Model/UserModel");
const GameRecord = require("./Model/GameRecordModel");
const FriendRequest = require("./Model/FriednRequestModel");

const {
    populate
} = require('./Model/UserModel');
const {
    normalize
} = require('path');

session = require("express-session")({
    secret: "my-secret",
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 800000
    }
})

const app = express();
const server = require("http").createServer(app);
const io = require('socket.io').listen(server);


const IN_GAME = 0;
const LIVE = 1;
const MATCHING = 2
const SEPECTATE = 3;

const BLUE = 4;
const YELLOW = 5;
const WHITE = 6;

let WAIT_ROOM = [];
let ACTIVE_GAMES = [];
let GAME_REQUEST = [];

app.use(express.static('public'));
app.use(express.json());
app.use(session);
io.use(sharedsession(session, {
    autoSave: true
}));


//Connect to database
mongoose.connect('mongodb://127.0.0.1/connect4_db', {
    useNewUrlParser: true
});
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function () {
    server.listen(3000);
    console.log("Server listening on port 3000");
});


io.on("connection", function (socket) {
    socket.on('enter_a_friend_game', function (room_code) {
        const game_index = find_host_active_game_index(room_code);
        const game = ACTIVE_GAMES[game_index];
        //delete the game requst first
        if (GAME_REQUEST.length != 0) {
            for (let i = 0; i < GAME_REQUEST.length; i++) {
                if (GAME_REQUEST[i].active_game_room_code == room_code) {
                    GAME_REQUEST.splice(i, 1);
                }
            }
        }
        socket.join(room_code);
        socket.emit('game_ready', game);
        io.sockets.in(room_code).emit('game_in_progress', game);
    });
    socket.on('start_a_friend_game', function (target_username) {
        const reciever_name = socket.handshake.session.username;
        const requester_name = target_username;
        const active_game_room_code = makeid(reciever_name.length)
        if (GAME_REQUEST.length != 0) {
            for (let i = 0; i < GAME_REQUEST.length; i++) {
                if (GAME_REQUEST[i].request_user == requester_name && GAME_REQUEST[i].recieve_user == reciever_name) {
                    GAME_REQUEST[i].status = "Accepted";
                    GAME_REQUEST[i].active_game_room_code = active_game_room_code;
                }
            }
        }
        const new_active_game = {
            'room_code': active_game_room_code,
            'players': [requester_name, reciever_name],
            'current_turn': reciever_name,
            'chat_history': [],
            'yellow': reciever_name,
            'blue': requester_name,
            'game_privacy': target_username,
            'playout': initiate_new_board()
        }
        const new_chat_log = {
            'username': 'Connect4_System',
            'message_content': 'Welcome to Connect 4, ' + reciever_name + '(Yellow) and ' +  requester_name + '(Blue).'
        }
        new_active_game.chat_history.push(new_chat_log);
        ACTIVE_GAMES.push(new_active_game);
        socket.join(active_game_room_code);
        socket.emit('game_ready', new_active_game);
        io.sockets.in(active_game_room_code).emit('game_in_progress', new_active_game);
    });
    socket.on('start_a_new_random_game', async (game_setting) => {
        const match_user = found_match_user(WAIT_ROOM, game_setting);
        if (match_user) {
            const joinning_room = match_user.room_code;
            socket.join(joinning_room);
            const new_active_game = {
                'room_code': joinning_room,
                'players': [socket.handshake.session.username, match_user.username],
                'current_turn': match_user.username,
                'chat_history': [],
                'yellow': match_user.username,
                'blue': socket.handshake.session.username,
                'game_privacy': game_setting,
                'playout': initiate_new_board()
            }
            const new_chat_log = {
                'username': 'Connect4_System',
                'message_content': 'Welcome to Connect 4, ' + match_user.username + '(Yellow) and ' +  socket.handshake.session.username + '(Blue).'
            }
            new_active_game.chat_history.push(new_chat_log);
            ACTIVE_GAMES.push(new_active_game);
            //notify user found game and starting the game
            io.sockets.in(joinning_room).emit('found_match', new_active_game);
            //delete the game that in the wait toom list
            delete_start_game_from_wait_room(WAIT_ROOM, joinning_room);
        } else {
            const username = socket.handshake.session.username;
            const room_code = makeid(username.length);
            const waiting_room = {
                'game_setting': game_setting,
                'username': username,
                'room_code': room_code
            };
            socket.handshake.session.user_status = MATCHING;
            WAIT_ROOM.push(waiting_room);
            socket.join(room_code);
            socket.emit('matching');
        }
    });
    socket.on('ready_for_game', function () {
        socket.handshake.session.user_status = IN_GAME;
    });

    socket.on('game_start', function (game) {
        const room_code = game.room_code;
        io.sockets.in(room_code).emit('game_in_progress', game);
    });

    socket.on('make_move', async function (move) {
        const game_room_code = move.room_code;
        const game_index = find_host_active_game_index(game_room_code);
        if (game_index === null) {
            console.log("server error")
        } else {
            const move_column = move.column;
            const move_player = socket.handshake.session.username;
            const move_color = find_move_color(ACTIVE_GAMES[game_index], move_player);
            const new_game_state = player_make_move(ACTIVE_GAMES[game_index], move_color, move_column);
            //check the game start
            const game_end = check_game(new_game_state);
            if (!game_end) {
                //update the game in the game list
                ACTIVE_GAMES[game_index].playout = new_game_state;
                //update next round player
                ACTIVE_GAMES[game_index].current_turn = get_next_turn_player(ACTIVE_GAMES[game_index]);
                io.sockets.in(game_room_code).emit('game_in_progress', ACTIVE_GAMES[game_index]);
            } else {
                const winner_username = socket.handshake.session.username;
                const opponent_username = get_opponent_name(ACTIVE_GAMES[game_index], winner_username);
                let game_record = new GameRecord();
                game_record.players = ACTIVE_GAMES[game_index].players;
                game_record.winner = winner_username;
                game_record.playout = new_game_state;
                await game_record.save();
                //save game record into both user info in database
                const game_record_id = game_record._id;
                const winner = await User.findOne({
                    username: winner_username
                }).exec();
                winner.games.push(game_record_id);
                const opponent = await User.findOne({
                    username: opponent_username
                }).exec();
                opponent.games.push(game_record_id);
                await opponent.save();
                await winner.save();
                //delete this game from active game list
                ACTIVE_GAMES.splice(game_index, 1);
                const data = {
                    'winner_name': winner_username,
                    'final_state': new_game_state
                }
                io.sockets.in(game_room_code).emit('game_end', data);
            }
        }
    });

    socket.on('back_game', function (room_code) {
        const game_index = find_host_active_game_index(room_code);
        const game = ACTIVE_GAMES[game_index];
        socket.join(room_code);
        io.sockets.in(room_code).emit('game_in_progress', game);
    });

    socket.on('sepectate_request', async function (room_code) {
        const game_index = find_host_active_game_index(room_code);
        const game = ACTIVE_GAMES[game_index];
        const current_username = socket.handshake.session.username;
        let sepectate_game_check = false;
        if (game.game_privacy == "friends") {
            const players = game.players;
            for (let i = 0; i < players.length; i++) {
                const player_name = players[i];
                const player = await User.findOne({
                    username: player_name
                }).exec();
                const friend_check = check_friend_relationship(player.friendlist, current_username);
                if (friend_check) {
                    sepectate_game_check = true;
                    break;
                }
            }
        } else if (game.game_privacy == "public") {
            sepectate_game_check = true;
        }
        let data = {
            'sepectate_game_check': sepectate_game_check,
            'room_code': room_code
        }
        socket.emit('sepectate_responsed', data);
    });

    socket.on('sepectate_game', function (room_code) {
        const game_index = find_host_active_game_index(room_code);
        const game = ACTIVE_GAMES[game_index];
        socket.join(room_code);
        const new_chat_log = {
            'username': 'Connect4_System',
            'message_content': socket.handshake.session.username + ' join in the room and sepectating.'
        }
        game.chat_history.push(new_chat_log)
        io.sockets.in(room_code).emit('game_in_progress', game);
    });

    socket.on('end_game', async function (room_code) {
        const game_index = find_host_active_game_index(room_code);
        const game = ACTIVE_GAMES[game_index];
        const opponent_username = get_opponent_name(game, socket.handshake.session.username);
        socket.join(room_code);
        //save the game into the database
        let game_record = new GameRecord();
        game_record.players = game.players;
        game_record.winner = opponent_username;
        game_record.playout = game.playout;
        await game_record.save();
        //save game record into both user info in database
        const game_record_id = game_record._id;
        const user = await User.findOne({
            username: socket.handshake.session.username
        }).exec();
        user.games.push(game_record_id);
        const opponent = await User.findOne({
            username: opponent_username
        }).exec();
        opponent.games.push(game_record_id);
        await opponent.save();
        await user.save();
        //delete this game from active game list
        ACTIVE_GAMES.splice(game_index, 1);
        const data = {
            'winner_name': opponent_username,
            'final_state': game.playout
        }
        io.sockets.in(room_code).emit('game_end', data);
    });

    socket.on('send_new_message', function (message_info) {
        const room_code = message_info.room_code;
        const game_index = find_host_active_game_index(room_code);
        const message_log = {
            'username': socket.handshake.session.username,
            'message_content': message_info.message
        }
        ACTIVE_GAMES[game_index].chat_history.push(message_log);
        const game = ACTIVE_GAMES[game_index];
        socket.join(room_code);
        io.sockets.in(room_code).emit('new_message', ACTIVE_GAMES[game_index].chat_history)

    })
});

function check_game(board) {
    let check = false;
    for (let i = 0; i < board.length; i++) { //row
        for (let j = 0; j < board[i].length; j++) { //column
            //check left
            if (j - 3 > 0) {
                if (board[i][j] != WHITE && board[i][j] == board[i][j - 1] && board[i][j - 1] == board[i][j - 2] && board[i][j - 2] == board[i][j - 3]) {
                    check = true;
                    break;
                }
            }
            //check right
            if (j + 3 < board[i].length - 1) {
                if (board[i][j] != WHITE && board[i][j] == board[i][j + 1] && board[i][j + 1] == board[i][j + 2] && board[i][j + 2] == board[i][j + 3]) {
                    check = true;
                    break;
                }
            }
            //check top
            if (i - 3 > 0) {
                if (board[i][j] != WHITE && board[i][j] == board[i - 1][j] && board[i - 1][j] == board[i - 2][j] && board[i - 2][j] == board[i - 3][j]) {
                    check = true;
                    break;
                }
            }
            //check bottom
            if (i + 3 < board.length - 1) {
                if (board[i][j] != WHITE && board[i][j] == board[i - 1][j] && board[i - 1][j] == board[i - 2][j] && board[i - 2][j] == board[i - 3][j]) {
                    check = true;
                    break;
                }
            }
            //check top-left
            if (j - 3 > 0 && i - 3 > 0) {
                if (board[i][j] != WHITE && board[i][j] == board[i - 1][j - 1] && board[i - 1][j - 1] == board[i - 2][j - 2] && board[i - 2][j - 2] == board[i - 3][j - 3]) {
                    check = true;
                    break;
                }
            }
            //check top-right
            if (j + 3 < board[i].length - 1 && i - 3 > 0) {
                if (board[i][j] != WHITE && board[i][j] == board[i - 1][j + 1] && board[i - 1][j + 1] == board[i - 2][j + 2] && board[i - 2][j + 2] == board[i - 3][j + 3]) {
                    check = true;
                    break;
                }
            }
            //check bottom-left
            if (j - 3 > 0 && i + 3 < board.length - 1) {
                if (board[i][j] != WHITE && board[i][j] == board[i + 1][j - 1] && board[i + 1][j - 1] == board[i + 2][j - 2] && board[i + 2][j - 2] == board[i + 3][j - 3]) {
                    check = true;
                    break;
                }
            }
            //check bottom-right
            if (i + 3 < board.length - 1 && j + 3 < board[i].length) {
                if (board[i][j] != WHITE && board[i][j] == board[i + 1][j + 1] && board[i + 1][j + 1] == board[i + 2][j + 2] && board[i + 2][j + 2] == board[i + 3][j + 3]) {
                    check = true;
                    break;
                }
            }

        }
    }
    return check;
}

function get_opponent_name(game, username) {
    let opponent;
    let game_players = game.players;
    for (let i = 0; i < 2; i++) {
        if (game_players[i] != username) {
            opponent = game_players[i];
            break;
        }
    }
    return opponent;
}

function get_next_turn_player(game) {
    const current_turn_player = game.current_turn;
    const players = game.players;
    let next_turn_player;
    for (let i = 0; i < players.length; i++) {
        if (players[i] != current_turn_player) {
            next_turn_player = players[i];
        }
    }
    return next_turn_player;
}

function player_make_move(game, move_color, move_column) {
    let game_board = game.playout;
    for (let i = game_board.length - 1; i >= 0; i--) {
        if (game_board[i][move_column] == WHITE) {
            game_board[i][move_column] = move_color;
            break;
        }
    }
    return game_board;
}

function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    if (ACTIVE_GAMES.length != 0) {
        for (let j = 0; j < ACTIVE_GAMES.length; j++) {
            if (ACTIVE_GAMES[j].room_code == result) {
                result = makeid(length);
            }
        }
    }
    return result;
}

function find_move_color(game, move_player) {
    if (game.yellow === move_player) {
        return YELLOW;
    } else {
        return BLUE;
    }
}

function find_host_active_game_index(game_room_code) {
    for (let i = 0; i < ACTIVE_GAMES.length; i++) {
        if (ACTIVE_GAMES[i].room_code == game_room_code) {
            return i;
        }
    }
    return null;
}

function initiate_new_board() {
    let new_game_board = [];
    for (let i = 0; i < 6; i++) {
        let new_row = [];
        for (let i = 0; i < 7; i++) {
            new_row.push(WHITE);
        }
        new_game_board.push(new_row);
    }
    return new_game_board;
}

function delete_start_game_from_wait_room(wait_room, room_code) {
    for (let i = 0; i < wait_room.length; i++) {
        if (wait_room[i].room_code === room_code) {
            wait_room.splice(i, 1);
            return;
        }
    }
    return;
}

function found_match_user(WAIT_ROOM, game_setting) {
    if (WAIT_ROOM.length === 0) {
        return null;
    }
    for (let i = 0; i < WAIT_ROOM.length; i++) {
        if (WAIT_ROOM[i].game_setting === game_setting) {
            return WAIT_ROOM[i];
        }
    }
    return null;
}

app.get('/get_all_friends_game', async function (req, res) {
    let active_friend_list = [];
    const username = req.session.username;
    const user = await User.findOne({
        username: username
    }).exec();
    const user_friendlist = user.friendlist;
    const store = req.sessionStore.sessions;
    for (var sid in store) {
        let active_session = JSON.parse(store[sid]);
        let active_session_username = active_session.username;
        let check = check_friend_relationship(user_friendlist, active_session_username);
        if (check) {
            active_friend_list.push(active_session_username);
        }
    }
    res.status(200).json({
        'active_friend_list': active_friend_list,
        'game_request': GAME_REQUEST,
        'username': username
    });
})

app.get('/client_session_info', function (req, res) {
    const session_username = req.session.username;
    res.status(200).json({
        'session_username': session_username
    });
});

app.get('/user_satatus', function (req, res) {
    const user_status = req.session.user_status;
    res.status(200).json({
        'user_status': user_status
    });
})

app.get('/login', function (req, res) {
    res.sendfile('./public/pages/landingpage.html');
});

app.post('/login', async function (req, res) {
    const {
        username,
        password
    } = req.body;
    const check = await check_login_info(username, password);
    if (check) {
        //session changed as loggedin
        req.session.loggedin = true;
        req.session.username = username;
        req.session.user_status = LIVE;
        res.status(200).json({
            'username': username
        });
    } else {
        res.status(401).send();
    }
});

app.get('/register', function (req, res) {
    res.sendfile('./public/pages/register.html');
});

app.post('/register', async function (req, res) {
    const {
        username,
        password
    } = req.body;
    const check = await check_register_info(username, password);
    if (check) {
        //session changed as loggedin
        req.session.loggedin = true;
        req.session.username = username;
        res.status(200).json({
            'username': username
        });
    } else {
        res.status(401).send();
    }
});

app.get('/dashboard', function (req, res) {
    if (req.session.loggedin) {
        res.sendfile('./public/pages/dashboard.html');
    } else {
        res.redirect('/login');
    }
});

app.get('/logout', function (req, res) {
    if (req.session.loggedin) {
        req.session.loggedin = false;
        res.status(200).redirect('/login');
    }
});

app.get('/profile', async function (req, res) {
    if (req.session.loggedin) {
        const username = req.session.username;
        const query = await User.findOne({
            username: username
        }).exec();
        let history_games_array = await get_history_games(query.games);
        let active_games_array = get_active_games(username);
        const data = {
            'username': query.username,
            'privacy': query.profile_privacy,
            'previous_games': history_games_array,
            "active_games": active_games_array
        }
        res.status(200).send(data);
    } else {
        res.status(401).send();
    }
});

app.get('/friends', async function (req, res) {
    if (req.session.loggedin) {
        const username = req.session.username;
        const query = await User.findOne({
            username: username
        }).exec();
        let friends_list = query.friendlist;
        let friends_request_send = await get_requests_from_request_id_list(query.friend_request_send_list);
        let friends_request_recieve = await get_requests_from_request_id_list(query.friend_request_recieved_list);
        const data = {
            'friend_list': friends_list,
            'friends_request_send': friends_request_send,
            'friends_request_recieve': friends_request_recieve
        }
        res.status(200).send(data);
    } else {
        res.status(401).send();
    }
});

app.get('/history', async function (req, res) {
    if (req.session.loggedin) {
        const username = req.session.username;
        const query = await User.findOne({
            username: username
        }).exec();
        const games = query.games;
        const history_games = await get_history_games(games);
        data = {
            'username': username,
            'history_games': history_games
        }
        res.status(200).send(data);
    } else {
        res.status(401).send()
    }
});

app.get('/friends_search', async function (req, res) {
    const search_username = req.query.search_username;
    let data;
    let query = await User.findOne({
        username: search_username
    }).exec();
    if (query != null) {
        if (query.username === req.session.username) {
            data = {
                'query_result': false,
                'message': "Why are you searching yourself? :-)"
            }
        } else {
            data = {
                'query_result': true,
                'user': query
            }
        }

    } else {
        data = {
            'query_result': false,
            'message': "No matching user"
        }
    }
    res.status(200).send(data);
});

app.post('/send_friend_request', async function (req, res) {
    const add_username = req.body.add_username;
    let friend_request = new FriendRequest();
    let request_validation = await validate_friend_request(add_username, req.session.username);
    if (request_validation) {
        friend_request.requester = req.session.username;
        friend_request.recipient = add_username;
        friend_request.save(async function (err, result) {
            if (err) {
                console.log("Error to create new friend request");
                return res.status(500).send();
            }
            const request_id = result._id;
            request_user = await User.findOne({
                username: req.session.username
            }).exec();
            recieve_user = await User.findOne({
                username: add_username
            }).exec();
            request_user.friend_request_send_list.push(request_id);
            recieve_user.friend_request_recieved_list.push(request_id);
            await request_user.save(function (err, result) {
                if (err) {
                    console.log("Error to save new friend request");
                    return res.status(500).send();
                }
            });
            await recieve_user.save(function (err, result) {
                if (err) {
                    console.log("Error to save new friend request");
                    return res.status(500).send();
                }
            });
            res.status(200).json({
                'status': 'normal',
                'request_id': request_id
            });
        });
    } else {
        res.status(200).json({
            'status': 'You guys are already friends or relationship in pending'
        });
    }
});


app.post('/accept_friend_request', async function (req, res) {
    const target_requester_username = req.body.target_username;
    const request_id = req.body.request_id;
    //find request in the requests database and delete
    await FriendRequest.deleteOne({
        _id: request_id
    }).exec();
    //find the request in the requester sent request list and delete it
    const requester = await User.findOne({
        username: target_requester_username
    }).exec();
    await requester.friend_request_send_list.pull(request_id);
    // //find the request in the recipient recieved request listr and delete it
    const recipient = await User.findOne({
        username: req.session.username
    }).exec();
    await recipient.friend_request_recieved_list.pull(request_id);
    // //since request is accepted, add their names into their friend list for each other
    await requester.friendlist.push(req.session.username);
    await recipient.friendlist.push(target_requester_username);
    await requester.save();
    await recipient.save();
    res.status(200).json({});
});

app.post('/ignore_friend_request', async function (req, res) {
    const target_requester_username = req.body.target_username;
    const request_id = req.body.request_id;
    //find request in the requests database and delete
    await FriendRequest.deleteOne({
        _id: request_id
    }).exec();
    //find the request in the requester sent request list and delete it
    const requester = await User.findOne({
        username: target_requester_username
    }).exec();
    await requester.friend_request_send_list.pull(request_id);
    // //find the request in the recipient recieved request listr and delete it
    const recipient = await User.findOne({
        username: req.session.username
    }).exec();
    await recipient.friend_request_recieved_list.pull(request_id);
    await requester.save();
    await recipient.save();
    res.status(200).json({});
});


app.post('/delete_friend', async function (req, res) {
    const delete_username = req.body.deleter_username;
    //delete it from both friends list of each other
    const requester = await User.findOne({
        username: req.session.username
    }).exec();
    requester.friendlist.pull(delete_username);
    const recipent = await User.findOne({
        username: delete_username
    }).exec();
    recipent.friendlist.pull(req.session.username);
    await requester.save();
    await recipent.save();
    res.status(200).json({});
});


app.post('/change_privacy_status', async function (req, res) {
    const update_status = req.body.privacy_status;
    const username = req.session.username;
    const user = await User.findOne({
        username: username
    }).exec();
    if (update_status == "private") {
        user.profile_privacy = true;
    } else if (update_status == "public") {
        user.profile_privacy = false;
    };
    await user.save();
    res.status(200).json({});
});

app.get('/visit_user_profile', async function (req, res) {
    var url = require('url');
    var url_parts = url.parse(req.url, true);
    var target_username = url_parts.query.search_username;
    const target_user = await User.findOne({
        username: target_username
    }).exec();
    let history_games_array = await get_history_games(target_user.games);
    let active_games_array = get_active_games(target_username);
    let friend_relationship_check = check_friend_relationship(target_user.friendlist, req.session.username);
    const data = {
        'user_id': target_user._id,
        'username': target_username,
        'history_games': history_games_array,
        'active_games': active_games_array,
        'friend_relationship': friend_relationship_check,
        'profile_privacy': target_user.profile_privacy,
        'visit_by': req.session.username
    };
    res.status(200).json({
        data
    });
});

app.get('/review_game_record', async function (req, res) {
    var url = require('url');
    var url_parts = url.parse(req.url, true);
    var game_record_id = url_parts.query.game_record_id;
    const query = await GameRecord.findOne({
        _id: game_record_id
    }).exec();
    res.status(200).json({
        'game_playout': query.playout
    });
})

app.get('/continue_active_games', function (req, res) {
    const username = req.session.username;
    let user_active_games = get_active_games(username);
    res.status(200).json({
        'user_active_games': user_active_games,
        'username': username
    });
})


app.post('/send_game_request', function (req, res) {
    const target_user = req.body.target_username;
    const request_user = req.session.username;
    const new_friend_game_request = {
        "request_user": request_user,
        "recieve_user": target_user,
        "status": "Pending",
        'active_game_room_code': null
    };
    GAME_REQUEST.push(new_friend_game_request)
    res.status(200).json({
        "game_request": GAME_REQUEST,
        'username': req.session.username
    });

});

app.post('/delete_sent_game_request', function (req, res) {
    const reciever_name = req.body.reciever_name;
    const requester_name = req.session.username;
    if (GAME_REQUEST.length != 0) {
        for (let i = 0; i < GAME_REQUEST.length; i++) {
            if (GAME_REQUEST[i].request_user == requester_name && GAME_REQUEST[i].recieve_user == reciever_name) {
                GAME_REQUEST.splice(i, 1);
            }
        }
    }
    res.status(200).json({
        'username': requester_name,
        'reciever_name': reciever_name
    });
})


app.post('/reject_recieved_game_request', function (req, res) {
    const requester_name = req.body.requester_name;
    const reciever_name = req.session.username;
    if (GAME_REQUEST.length != 0) {
        for (let i = 0; i < GAME_REQUEST.length; i++) {
            if (GAME_REQUEST[i].request_user == requester_name && GAME_REQUEST[i].recieve_user == reciever_name) {
                GAME_REQUEST[i].status = "Rejected";
            }
        }
    }
    res.status(200).json({
        'username': requester_name,
        'reciever_name': reciever_name
    });
});

app.get('/users', function (req, res) {
    var url = require('url');
    var url_parts = url.parse(req.url, true);
    var name_query = url_parts.query.name;
    if (name_query) {
        User.find({}, function (err, users) {
            var userMap = {};
            users.forEach(function (user) {
                if (String(user.username).includes(String(name_query))) {
                    if (!user.profile_privacy) {
                        userMap[user.username] = user;
                    }
                }
            });
            res.send(userMap);
        });
    } else {
        User.find({}, function (err, users) {
            var userMap = {};
            users.forEach(function (user) {
                userMap[user.username] = user;
            });
            res.send(userMap);
        });
    }
});

app.get('/users/:user', function (req, res) {
    let user = req.params.user;
    if (user) {
        User.findOne({
            username: user,
            profile_privacy: false
        }, function (err, user) {
            if (user) {
                console.log(user);
                const respond = {
                    "username": user.username,
                    "number of games": user.games.length,
                    "win rate": caculate_win_rate(user.games),
                    "current_active_game": get_active_games(user.username)
                }
                res.send(respond);
            } else {
                res.send(null);
            }
        });
    } else {
        res.sendStatus(400);
    }

});


app.get('/games', async function (req, res) {
    const url = require('url');
    const url_parts = url.parse(req.url, true);
    const player = url_parts.query.player;
    const active = url_parts.query.active;
    let detail = url_parts.query.detail;
    let active_games_result = [];
    let completed_games_result = [];
    let games_result = [];
    if (!detail) {
        detail = "summary";
    }
    if (active != null) {
        if (active == "true") {
            //only active games is considered
            if (player) {
                //if user is sepecified and actived game is considered
                if (ACTIVE_GAMES.length != 0) {
                    for (let i = 0; i < ACTIVE_GAMES.length; i++) {
                        const player_in_game_check = check_player_in_game(ACTIVE_GAMES[i], player);
                        if (player_in_game_check) {
                            active_games_result.push(ACTIVE_GAMES[i]);
                        }
                    }
                } else {
                    return res.send({'games':[]});
                }
            } else {
                //all user should be included and active game is considered
                if (ACTIVE_GAMES.length != 0) {
                    for (let i = 0; i < ACTIVE_GAMES.length; i++) {
                        active_games_result.push(ACTIVE_GAMES[i]);
                    }
                } else {
                    return res.send({'games':[]});
                }
            }
        } else {
            //only complete games is considered
            if (player) {
                //if user is sepecified and completed game is considered
                await GameRecord.find({}, function (err, game_records) {
                    if (err) {
                        throw new Error("No game record in the database");
                    } else {
                        if (typeof game_records != "undefined"){
                            if (game_records.length != 0) {
                                for (let i = 0; i < game_records.length; i++) {
                                    const player_in_game_check = check_player_in_game(game_records[i], player);
                                    if (player_in_game_check) {
                                        completed_games_result.push(game_records[i]);
                                    }
                                }
                            } else {
                                return res.send({'games':[]});
                            }
                        }
                    }
                });

            } else {
                //all users inclueded and only completed game is considered
                await GameRecord.find({}, function (err, game_records) {
                    if (err) {
                        throw new Error("No game record in the database");
                    } else {
                        if (typeof game_records != "undefined") {
                            if (game_records.length != 0) {
                                for (let i = 0; i < game_records.length; i++) {
                                    completed_games_result.push(game_records[i]);
                                }
                            } else {
                                return res.send({'games':[]});
                            }
                        }
                    }
                });
            }
        }

    } else {
        //all game shoule be considered include complete game and active game
        if (player) {
            //user is sepecified and all games include active and completed
            if (ACTIVE_GAMES.length != 0) {
                for (let i = 0; i < ACTIVE_GAMES.length; i++) {
                    const player_in_game_check = check_player_in_game(ACTIVE_GAMES[i], player);
                    if (player_in_game_check) {
                        active_games_result.push(ACTIVE_GAMES[i]);
                    }
                }
            }
            await GameRecord.find({}, function (err, game_records) {
                if (err) {
                    throw new Error("No game record in the database");
                } else {
                    if (typeof game_records != "undefined") {
                        if (game_records.length != 0) {
                            for (let i = 0; i < game_records.length; i++) {
                                const player_in_game_check = check_player_in_game(game_records[i], player);
                                if (player_in_game_check) {
                                    completed_games_result.push(game_records[i]);
                                }
                            }
                        }
                    }
                }
            });


        } else {
            //all users included and all games includede active and comlpeted
            if (ACTIVE_GAMES.length != 0) {
                for (let i = 0; i < ACTIVE_GAMES.length; i++) {
                    active_games_result.push(ACTIVE_GAMES[i]);
                }
            }
            await GameRecord.find({}, function (err, game_records) {
                const check = (typeof game_records != "undefined");
                if (err) {
                    throw new Error("Internal error");
                } else {
                    if (typeof game_records != "undefined") {
                        if (game_records.length != 0) {
                            for (let i = 0; i < game_records.length; i++) {
                                completed_games_result.push(game_records[i]);

                            }
                        }
                    }
                }
            });
        }
    }
    if (active_games_result.length != 0) {
        if (detail == "summary") {
            for (let i = 0; i < active_games_result.length; i++) {
                const new_game_summary = {
                    'players': active_games_result[i].players,
                    'status': "In progress"
                }
                games_result.push(new_game_summary);
            }
        } else if (detail == "full") {
            for (let i = 0; i < active_games_result.length; i++) {
                const new_game_summary = {
                    'players': active_games_result[i].players,
                    'status': "In progress",
                    'playout': active_games_result[i].playout
                }
                games_result.push(new_game_summary);
            }
        }
    }
    if (completed_games_result.length != 0) {
        if (detail == "summary") {
            for (let i = 0; i < completed_games_result.length; i++) {
                const new_game_summary = {
                    'players': completed_games_result[i].players,
                    'status': "Completed",
                    'winner': completed_games_result[i].winner,
                    'number of turns': caculate_turn(completed_games_result[i].playout),
                    'forfeited': check_forfeited(completed_games_result[i].playout)
                }
                games_result.push(new_game_summary);
            }
        } else if (detail == "full") {
            for (let i = 0; i < completed_games_result.length; i++) {
                const new_game_summary = {
                    'players': completed_games_result[i].players,
                    'status': "Completed",
                    'winner': completed_games_result[i].winner,
                    'number of turns': caculate_turn(completed_games_result[i].playout),
                    'forfeited': check_forfeited(completed_games_result[i].playout),
                    "playout": completed_games_result[i].playout
                }
                games_result.push(new_game_summary);
            }
        }

    }
    return res.send({'games':games_result});
});


function check_forfeited(game_board) {
    let check = false;
    let game_end = check_game(game_board);
    if (!game_end) {
        check = true;
    }
    return check;
}

function caculate_turn(game_board) {
    let count = 0;
    for (let i = 0; i < game_board.length; i++) {
        for (let j = 0; j < game_board[i].length; j++) {
            if (game_board[i][j] != WHITE) {
                count += 1;
            }
        }
    }
    return count;
}

function check_player_in_game(game, username) {
    let check = false;
    const game_players = game.players;
    const query_username = String(username)
    if (game_players.length != 0) {
        for (let i = 0; i < game_players.length; i++) {
            if (String(game_players[i].includes(query_username))) {
                check = true;
                break;
            }
        }
    }
    return check;
}


function caculate_win_rate(games_history_array, username) {
    let number_of_win = 0;
    const number_of_games = games_history_array.length;
    if (number_of_games === 0) {
        return "0%";
    } else {
        for (let i = 0; i < number_of_games; i++) {
            if (games_history_array[i].winner == username) {
                number_of_win += 1;
            }
        }
    }
    let win_rate = number_of_win / number_of_games * 100;
    let result = win_rate.toString().concat("%");
    return result;

}

function check_friend_relationship(friend_list, username) {
    let check = false;
    for (let i = 0; i < friend_list.length; i++) {
        if (friend_list[i] == username) {
            check = true;
        }
    }
    return check;
}

async function validate_friend_request(recipient_username, requester_username) {
    let check = true
    const recipent_user = await User.findOne({
        username: recipient_username
    }).exec();
    const requester_user = await User.findOne({
        username: requester_username
    }).exec();
    //check if requester already sent a request to the recipent
    const requester_sent_requests = await get_requests_from_request_id_list(requester_user.friend_request_send_list);
    for (let i = 0; i < requester_sent_requests.length; i++) {
        if (requester_sent_requests[i].recipient === recipient_username) {
            check = false;
        }
    }
    //check if requester already sent a request to the requester
    const recipient_sent_requests = await get_requests_from_request_id_list(recipent_user.friend_request_send_list)
    for (let j = 0; j < recipient_sent_requests.length; j++) {
        if (recipient_sent_requests[j].recipient === requester_username) {
            check = false;
        }
    }
    //check it recipent and requester are already friends
    const requester_friend_list = requester_user.friendlist;
    for (let k = 0; k < requester_friend_list.length; k++) {
        if (requester_friend_list[k] === recipient_username) {
            chekc = false;
        }
    }
    return check;
}


async function get_requests_from_request_id_list(request_id_list) {
    let requests_list = [];
    if (request_id_list.length === 0) {
        return requests_list;
    } else {
        for (let i = 0; i < request_id_list.length; i++) {
            let query = await FriendRequest.findOne({
                _id: request_id_list[i]
            }).exec();
            requests_list.push(query);
        }
    }
    return requests_list;
}

async function get_history_games(games_ids_array) {
    let histoty_games_array = [];
    if (games_ids_array.length === 0) {
        return histoty_games_array;
    } else {
        for (let i = 0; i < games_ids_array.length; i++) {
            let query = await GameRecord.findOne({
                _id: games_ids_array[i],
            }).exec();
            histoty_games_array.push(query);
        }
    }
    return histoty_games_array;
}

function get_active_games(username) {
    let active_games_array = [];
    if (ACTIVE_GAMES.length != 0) {
        for (let i = 0; i < ACTIVE_GAMES.length; i++) {
            for (let j = 0; j < ACTIVE_GAMES[i].players.length; j++) {
                if (ACTIVE_GAMES[i].players[j] == username) {
                    active_games_array.push(ACTIVE_GAMES[i]);
                    break;
                }
            }
        }
    }
    return active_games_array;
}

async function check_login_info(username, password) {
    let check = false;
    const query = await User.findOne({
        username: username
    }).exec();
    if (query) {
        const query_password = query.password
        if (query_password === password) {
            check = true;
        }
    }
    return check;
}

async function check_register_info(username, password) {
    let check = false;
    const query = await User.findOne({
        username: username
    }).exec();
    //if user name is new
    if (query === null) {
        //create new user and save into the database
        let new_user = new User();
        new_user.username = username;
        new_user.password = password;
        await new_user.save(function (err) {
            if (err) {
                console.log('Error on register new user in database');
                throw new Error('Error on register new user in database');
            }
        });
        check = true;
    }
    return check;

}