let socket = null;

const IN_GAME = 0;
const LIVE = 1;
const MATCHING = 2
const SEPECTATE = 3;

const BLUE = 4;
const YELLOW = 5;
const WHITE = 6;


$("#login_info").submit(function (event) {
    event.preventDefault();
    const username = $('#login_info').find('input[id="username"]').val();
    const password = $('#login_info').find('input[id="password"]').val();
    const info = {
        'username': username,
        'password': password
    };
    $.ajax({
        method: "POST",
        data: JSON.stringify(info),
        contentType: "application/json",
        dataType: "json",
        url: '/login',
    }).done(function (result) {
        window.location.href = '/dashboard';
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert("Invalid username or password");
        window.location.href = '/login'
    });
});


function recieve_game_request(request_username) {
    var r = confirm("You recieve a game request from " + request_username);
    if (r == true) {
        if (socket == null) {
            socket = io();
        }
        socket.emit('accept_game_request', request_username);
    } else {
        socket.emit('reject_game_request', request_username);
    }
}

$("#register_info").submit(function (event) {
    event.preventDefault();
    let username = $('#register_info').find('input[id="username"]').val();
    let password = $('#register_info').find('input[id="password"]').val();
    const info = {
        'username': username,
        'password': password
    };
    $.ajax({
        method: "POST",
        data: JSON.stringify(info),
        contentType: "application/json",
        dataType: "json",
        url: '/register',
    }).done(function (result) {
        alert('Register Success, redirecting to dashboard');
        window.location.href = '/dashboard';
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert('Username existed, Please choose another one');
        window.location.href = '/register';
    });
});


function game_button() {
    $('.active').removeClass('active');
    $('.game').addClass('active');
    $('.col-sm-9').empty();
    const button_group = [];
    button_group.push('<div class="button-group"> ');
    button_group.push("<button type='button' class='btn btn-primary game-btn' onclick='start_a_new_game()'>Start a new game</button>");
    button_group.push("<button  type='button' class='btn btn-primary game-btn' onclick='continued_an_actived_game()'>Continued an actived game</button>");
    button_group.push('</div>');
    const button_group_content = button_group.join("");
    $('.col-sm-9').append(button_group_content);
}

function profile_button() {
    $('.active').removeClass('active');
    $('.profile').addClass('active');
    $('.col-sm-9').empty();
    let username = "";
    let userid = "";
    let privacy = false;
    let number_of_games = 0;
    let win_rate = 0;
    let last_five_games = [];
    let active_games = [];
    let new_content = [];
    let self_profile_check = true;
    $.get('/profile', function (data) {
        username = data.username;
        privacy = data.privacy;
        previous_games = data.previous_games;
        number_of_games = previous_games.length;
        active_games = data.active_games;
        win_rate = caculate_win_rate(previous_games, username);
        last_five_games = get_last_five_games(previous_games);
        new_content = create_user_profile_content(username, privacy, number_of_games, win_rate, last_five_games, active_games, self_profile_check);
        $('.col-sm-9').append(new_content);
    }).fail(function () {
        alert('Authentication error, please login again');
        window.location.href = '/login';
    });
}

function friends_button() {
    $('.active').removeClass('active');
    $('.friends').addClass('active');
    $('.col-sm-9').empty();
    let friend_list = [];
    let friends_request_send = [];
    let friends_request_recieve = [];
    let query_content = ""
    $.get('/friends', function (data) {
        friend_list = data.friend_list;
        friends_request_send = data.friends_request_send;
        friends_request_recieve = data.friends_request_recieve;
        query_content = create_friends_query_conent(friend_list, friends_request_send, friends_request_recieve);
        $('.col-sm-9').append(query_content);
    }).fail(function () {
        alert('Authentication error, please login again');
        window.location.href = '/login'
    });
}

function history_button() {
    $('.active').removeClass('active');
    $('.history').addClass('active');
    $('.col-sm-9').empty();
    $.get('/history', function (data) {
        const username = data.username;
        const history_games = data.history_games;
        const new_content = create_history_games_list(history_games, username);
        $('.col-sm-9').append(new_content);
    }).fail(function () {
        alert('Authentication error, please login again');
        window.location.href = '/login'
    });
}

function create_history_games_list(history_games, username) {
    let new_content = [];
    new_content.push('<div class="info-div">');
    new_content.push('  <table class="games-hisotry">');
    new_content.push('      <tbody>');
    new_content.push('          <tr><th colspan="3">History Games</th></tr>');
    new_content.push('          <tr style="background-color:yellow;"><td>Opponent</td><td>Winner</td><td>Action</td></tr>');
    if (history_games.length != 0) {
        for (let i = 0; i < history_games.length; i++) {
            new_content.push(' <tr>');
            const opponent_name = get_opponent_name(history_games[i], username);
            new_content.push('  <td>');
            new_content.push(opponent_name);
            new_content.push('  </td>');
            new_content.push('  <td>');
            new_content.push(history_games[i].winner);
            new_content.push('  </td>');
            new_content.push('  <td>');
            new_content.push('      <button value="');
            new_content.push(history_games[i]._id);
            new_content.push('" onclick="review(this.value)">Review</button>');
            new_content.push('</tr>');
        }
    } else {
        new_content.push('<td colspan="3">No game history</td>')
    }
    new_content.push('      </tbody>');
    new_content.push('  </table>');
    new_content.push('</div>');
    return new_content.join("");
}

function create_friends_query_conent(friend_list, friends_request_send, friends_request_recieve) {
    let new_content = [];
    new_content.push('<div class="info-div">');
    new_content.push('  <table class="friends-table">');
    new_content.push('      <tbody>');
    new_content.push('          <tr>');
    new_content.push('              <th colspan="2">Friends</th>');
    new_content.push('          </tr>');
    if (friend_list.length != 0) {
        for (let i = 0; i < friend_list.length; i++) {
            new_content.push('  <tr>')
            new_content.push('      <td>');
            new_content.push('          <a class="friend-list-username" name="' + friend_list[i] + '" onclick="visit_user_profile(this.name)">');
            new_content.push(friend_list[i]);
            new_content.push('          </a>');
            new_content.push('      </td>');
            new_content.push('      <td><button name="' + friend_list[i] + '" onclick="delete_friend(this.name)">Delete</button></td>');
            new_content.push('  <tr>');
        }
    } else {
        new_content.push('<td colspan="2">No friends in friend list</td>');
    }
    new_content.push('      </tbody>');
    new_content.push('  </table><br><br>');

    new_content.push('  <table class="friends-request-table">');
    new_content.push('      <tbody>');
    new_content.push('          <tr>');
    new_content.push('              <th colspan="2">Sent friend request</th>');
    new_content.push('          </tr>');
    new_content.push('          <tr style="background-color:yellow;">');
    new_content.push('              <td>Username</td><td>Status</td>');
    new_content.push('          </tr>');
    if (friends_request_send.length != 0) {
        for (let i = 0; i < friends_request_send.length; i++) {
            new_content.push('<tr>');
            new_content.push('  <td>');
            new_content.push(friends_request_send[i].recipient);
            new_content.push('  </td>');
            new_content.push('  <td>Pending</td>');
            new_content.push('</tr>');
        }
    } else {
        new_content.push('<tr><td colspan="2">No requests</td></tr>')
    }
    new_content.push('      </tbody>');
    new_content.push('  </table><br><br>');

    new_content.push('  <table class="friends-request-table">');
    new_content.push('      <tr>');
    new_content.push('          <th colspan="2">Recieved friend request</th>');
    new_content.push('      </tr>');
    new_content.push('      <tr style="background-color:yellow;">');
    new_content.push('          <td>Username</th>');
    new_content.push('          <td>Action</th>');
    new_content.push('      </tr>');
    if (friends_request_recieve.length != 0) {
        for (let i = 0; i < friends_request_recieve.length; i++) {
            new_content.push('  <tr>');
            new_content.push('  <td class="request_from" value="' + friends_request_recieve[i]._id + '" name="' + friends_request_recieve[i].requester + '">');
            new_content.push(friends_request_recieve[i].requester);
            new_content.push('  </td>');
            new_content.push('  <td><button class="request-action" onclick="request_accept()">Accept</button><button class="request-action" onclick="request_ignore()">Ignore</button></td>');
            new_content.push('  </tr>');
        }
    } else {
        new_content.push('<td colspan="2">No requests</td>')
    }
    new_content.push('  </table><br><br>');

    new_content.push('  <table class="friends-table">');
    new_content.push('      <tbody class="friends_search">');
    new_content.push('          <tr>');
    new_content.push('              <th colspan="2">Search Result</th>');
    new_content.push('          </tr>');
    new_content.push('          <tr>');
    new_content.push('              <td colspan="2"><input type="text" placeholder="Seach users..." id="search" value=""></input><button type="submit" onclick="friend_search()">Search</button></td>');
    new_content.push('          </tr>');
    new_content.push('          <tr class="search-result"></tr>')
    new_content.push('      </tbody>');
    new_content.push('  </table>');
    new_content.push('</div>');
    return new_content.join("");
}

function create_user_profile_content(username, privacy, number_of_games, win_rate, last_five_games, active_games, self_profile_check) {
    let new_content = [];
    new_content.push('<div class="info-div">')
    new_content.push('<table>');
    new_content.push('  <tbody>');
    new_content.push('      <tr>');
    new_content.push('          <td>Username: </td>');
    new_content.push('          <td>');
    new_content.push(username);
    new_content.push('          </td>');
    new_content.push('      </tr>');
    new_content.push('      <tr>');
    if (self_profile_check) {
        new_content.push('          <td>Privacy: </td>');
        if (privacy) {
            new_content.push('      <td><select class="privacy-status" onchange="change_privacy_status()"><option value="private" selected>Private</option><option value="public">Public</option></select></td>');
        } else {
            new_content.push('      <td><select class="privacy-status" onchange="change_privacy_status()"><option value="private">Private</option><option value="public" selected>Public</option></select></td>');
        }
    }
    new_content.push('      </tr>');
    new_content.push('      <tr>');
    new_content.push('          <td>Number of games </td>');
    new_content.push('          <td>');
    new_content.push(number_of_games);
    new_content.push('          </td>');
    new_content.push('      </tr>');
    new_content.push('      <tr>');
    new_content.push('          <td>Win rate</td>');
    new_content.push('          <td>');
    new_content.push(win_rate);
    new_content.push('          </td>');
    new_content.push('      </tr>')
    new_content.push('  </tbody>');
    new_content.push('</table><br>');
    new_content.push('<table class="game-list">');
    new_content.push('  <tbody>');
    new_content.push('      <tr>');
    new_content.push('          <th colspan="3">Recent five games</th>');
    new_content.push('      </tr>');
    new_content.push('      <tr>');
    new_content.push('          <td>Opponent Name</th>');
    new_content.push('          <td>Winner</th>');
    new_content.push('          <td>Action</th>');
    new_content.push('      </tr>');
    if (last_five_games.length != 0) {
        for (let i = 0; i < last_five_games.length; i++) {
            new_content.push('      <tr>');
            let opponent_name = get_opponent_name(last_five_games[i], username);
            new_content.push('          <td>');
            new_content.push(opponent_name);
            new_content.push('          </td>');
            new_content.push('          <td>');
            new_content.push(last_five_games[i].winner);
            new_content.push('          </td>');
            new_content.push('          <td>');
            new_content.push('<button value="');
            new_content.push(last_five_games[i]._id);
            new_content.push('" onclick="review(this.value)">Review</button>');
            new_content.push('          </td>');
            new_content.push('      </tr>');
        }
    } else {
        new_content.push('      <tr>');
        new_content.push('          <td colspan="3">No game History</th>');
        new_content.push('      </tr>');
    }
    new_content.push('  </tbody>');
    new_content.push('</table>');
    new_content.push('<br>');
    new_content.push('<table class="game-list">');
    new_content.push('  <tbody>');
    new_content.push('      <tr>');
    new_content.push('          <th colspan="3">Active games</th>');
    new_content.push('      </tr>');
    new_content.push('      <tr>');
    new_content.push('          <td>Opponent Name</th>');
    new_content.push('          <td>Turn info</th>');
    new_content.push('          <td>Action</th>');
    new_content.push('      </tr>');
    if (active_games.length != 0) {
        for (let i = 0; i < active_games.length; i++) {
            new_content.push('      <tr>');
            let opponent_name = get_opponent_name(active_games[i], username);
            new_content.push('          <td>');
            new_content.push(opponent_name);
            new_content.push('          </td>');
            const turn_check = check_turn(username, active_games[i]);
            if (turn_check) {
                new_content.push('<td>Your turn</td>');
            } else {
                new_content.push('<td>Opponent turn</td>');
            }
            new_content.push('          <td>');
            new_content.push('<button value="');
            new_content.push(active_games[i].room_code);
            new_content.push('" onclick="continue_game(this.value)">Back game</button>');
            new_content.push('          </td>');
            new_content.push('      </tr>');
        }
    } else {
        new_content.push('      <tr>');
        new_content.push('          <td colspan="3">No active games</th>');
        new_content.push('      </tr>');
    }
    new_content.push('  </tbody>');
    new_content.push('</table>');
    new_content.push('</div>')
    return new_content.join("");
}

function check_turn(username, game) {
    if (game.current_turn == username) {
        return true;
    }
    return false;
}

function get_last_five_games(games_history_array) {
    let last_five_games = [];
    if (games_history_array.length < 5) {
        return games_history_array
    } else {
        for (let i = games_history_array.length - 1; i > games_history_array.length - 6; i--) {
            last_five_games.push(games_history_array[i]);
        }
    }
    return last_five_games;
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

function friend_search() {
    $.ajax({
        url: "/friends_search",
        type: "get", //send it through get method
        data: {
            'search_username': $('#search').val()
        },
        success: function (response) {
            $('.search-result').empty();
            if (response.query_result) {
                $('.search-result').append('<td class="target-username"><a name="' + response.user.username + '" onclick=visit_user_profile(this.name)>' + response.user.username + '</a></td><td><button onclick="add_friend()">Add</button></td>');
            } else {
                $('.search-result').append('<td colspan="2">' + response.message + '</td>');
            }
        },
        error: function (xhr) {
            alert('Query error');
        }
    });
}

function add_friend() {
    const add_username = $('.target-username').text().trim();
    console.log(JSON.stringify(add_username))
    const info = {
        'add_username': add_username
    }
    $.ajax({
        method: "POST",
        data: JSON.stringify(info),
        contentType: "application/json",
        dataType: "json",
        url: '/send_friend_request',
    }).done(function (result) {
        if (result.status != 'normal') {
            alert(result.status);
        } else {
            alert('Friend request sent');
        }
        friends_button();
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert('Unable send friend request');
        friends_button();
    });
}


function request_accept() {
    const target_username = $('.request_from').attr('name');
    const request_id = $('.request_from').attr('value');
    const data = {
        'target_username': target_username,
        'request_id': request_id
    }
    $.ajax({
        method: "POST",
        data: JSON.stringify(data),
        contentType: "application/json",
        dataType: "json",
        url: '/accept_friend_request',
    }).done(function (result) {
        alert("You accept request");
        friends_button();
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert('Unable accept friend request');
        friends_button();
    });
}



function request_ignore() {
    const target_username = $('.request_from').attr('name');
    const request_id = $('.request_from').attr('value');
    const data = {
        'target_username': target_username,
        'request_id': request_id
    }
    $.ajax({
        method: "POST",
        data: JSON.stringify(data),
        contentType: "application/json",
        dataType: "json",
        url: '/ignore_friend_request',
    }).done(function (result) {
        alert("You ignored request");
        friends_button();
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert('Unable ignore friend request');
        friends_button();
    });
}


function delete_friend(username) {
    const targer_username = username;
    const data = {
        'deleter_username': targer_username
    }
    $.ajax({
        method: "POST",
        data: JSON.stringify(data),
        contentType: "application/json",
        dataType: "json",
        url: '/delete_friend',
    }).done(function (result) {
        alert("This guy has been removed from your friend list");
        friends_button();
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert('Unable to delete this user');
        friends_button();
    });

}

function change_privacy_status(selected_option) {
    const status = $(".privacy-status option:selected").val();
    const data = {
        'privacy_status': status
    }
    $.ajax({
        method: "POST",
        data: JSON.stringify(data),
        contentType: "application/json",
        dataType: "json",
        url: '/change_privacy_status',
    }).done(function (result) {
        alert("You have changed your profile to " + status);
        profile_button();
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert('Unable to update your profile pravicy');
        profile_button();
    });

};

function visit_user_profile(name) {
    $.ajax({
        url: "/visit_user_profile",
        type: "get",
        data: {
            'search_username': name
        },
        success: function (response) {
            $('.col-sm-9').empty();
            const friend_relationship = response.data.friend_relationship;
            const profile_privacy = response.data.profile_privacy;
            if (!profile_privacy || friend_relationship) {
                const new_content = create_visit_profile_content(friend_relationship, response.data);
                $('.col-sm-9').append(new_content);
            } else {
                $('.col-sm-9').append('<h2 style="padding-top:25%; padding-left: 15%;">' + name + ' is a Private Account<h2>');
            }
        },
        error: function (xhr) {
            alert('Query error');
        }
    });
}

function create_visit_profile_content(friend_relationship, friend_user) {
    let new_content = [];
    new_content.push('<div class="info-div">')
    if (friend_relationship) {
        new_content.push('<h1>Friend Profile</h1>')
    } else {
        new_content.push('<h1>User Profile</h1>')
    }
    new_content.push('<table>');
    new_content.push('  <tbody>');
    new_content.push('      <tr>');
    new_content.push('          <td>Username: </td>');
    new_content.push('          <td class="target-username">');
    new_content.push(friend_user.username);
    new_content.push('          </td>');
    new_content.push('      </tr>');
    new_content.push('      <tr>');
    new_content.push('          <td>Number of games </td>');
    new_content.push('          <td>');
    new_content.push(friend_user.history_games.length);
    new_content.push('          </td>');
    new_content.push('      </tr>');
    new_content.push('      <tr>');
    new_content.push('          <td>Win rate</td>');
    new_content.push('          <td>');
    new_content.push(caculate_win_rate(friend_user.history_games, friend_user.username));
    new_content.push('          </td>');
    new_content.push('      </tr>')
    new_content.push('  </tbody>');
    new_content.push('</table><br>');
    new_content.push('<table class="game-list">');
    new_content.push('  <tbody>');
    new_content.push('      <tr>');
    new_content.push('          <th colspan="3">Recent five games</th>');
    new_content.push('      </tr>');
    new_content.push('      <tr>');
    new_content.push('          <td>Opponent Name</th>');
    new_content.push('          <td>Winner</th>');
    new_content.push('          <td>Action</th>');
    new_content.push('      </tr>');
    const last_five_games = get_last_five_games(friend_user.history_games);
    if (last_five_games.length != 0) {
        for (let i = 0; i < last_five_games.length; i++) {
            new_content.push('      <tr>');
            let opponent_name = get_opponent_name(last_five_games[i], friend_user.username);
            new_content.push('          <td>');
            new_content.push(opponent_name);
            new_content.push('          </td>');
            new_content.push('          <td>');
            new_content.push(last_five_games[i].winner);
            new_content.push('          </td>');
            new_content.push('          <td>');
            new_content.push('<button value="');
            new_content.push(last_five_games[i]._id);
            new_content.push('" onclick="review(this.value)">Review</button>');
            new_content.push('          </td>');
            new_content.push('      </tr>');
        }
    } else {
        new_content.push('      <tr>');
        new_content.push('          <td colspan="3">This guy have never play this game :-(</th>');
        new_content.push('      </tr>');
    }
    new_content.push('  </tbody>');
    new_content.push('</table>');
    new_content.push('<br>');
    new_content.push('<table class="game-list">');
    new_content.push('  <tbody>');
    new_content.push('      <tr>');
    new_content.push('          <th colspan="2">Active games</th>');
    new_content.push('      </tr>');
    new_content.push('      <tr>');
    new_content.push('          <td>Opponent Name</th>');
    new_content.push('          <td>Action</th>');
    new_content.push('      </tr>');
    const active_games = friend_user.active_games;
    if (active_games.length != 0) {
        for (let i = 0; i < active_games.length; i++) {
            new_content.push('      <tr>');
            let opponent_name = get_opponent_name(active_games[i], friend_user.username);
            new_content.push('          <td>');
            new_content.push(opponent_name);
            new_content.push('          </td>');
            new_content.push('          <td>');
            new_content.push('<button value="');
            new_content.push(active_games[i].room_code);
            if (opponent_name == friend_user.visit_by) {
                new_content.push('" onclick="continue_game(this.value)">Back game</button>');
            } else {
                new_content.push('" onclick="sepectate_game(this.value)">Sepectate</button>');
            }
            new_content.push('          </td>');
            new_content.push('      </tr>');
        }
    } else {
        new_content.push('      <tr>');
        new_content.push('          <td colspan="2">No active games</th>');
        new_content.push('      </tr>');
    }
    new_content.push('  </tbody>');
    new_content.push('</table><br><br>');
    if (!friend_relationship) {
        new_content.push('<button onclick="add_friend()">Send friend request</button>');
    } else {
        new_content.push('<button name="' + friend_user.username + '" onclick="delete_friend(this.name)">Delete from friend list</button>')
    }
    new_content.push('</div>');
    return new_content.join("");

}

function sepectate_game(room_code) {
    if (socket == null) {
        socket = io();
    }
    socket.emit('sepectate_request', room_code);
    socket.on('sepectate_responsed', sepectate_request);
    // socket.on('game_in_progress', game_in_progress);
}

function sepectate_request(sepectate_authorized_info) {
    const sepectate_authorized = sepectate_authorized_info.sepectate_game_check
    const sepectate_game_room_code = sepectate_authorized_info.room_code
    if (sepectate_authorized) {
        socket.emit('sepectate_game', sepectate_game_room_code);
        socket.on('game_in_progress', sepectate_game_in_progress);
    } else {
        alert("you dont have the access to the room");
    }
}


function sepectate_game_in_progress(game) {
    initiate_game_board(game.room_code);
    game_in_progress(game);
    socket.on('game_end', function (data) {
        load_game_board(data.final_state);
        alert("Game end, Winner is: " + data.winner_name);
        $('.game-button').prop("disabled", true);
        $('.game-page h3').empty();
        $('.game-page h3').append("Game end");
        $('.chat-history-box').hide();
        $('.chat-box').hide();
        $('.end-game-button').hide();
    });
}


function initiate_game_board(room_code) {
    game_button();
    $('.col-sm-9').empty();
    let new_content = [];
    new_content.push('<div class="game-page" value="' + room_code + '">');
    new_content.push('  <h3 class="turn-info">Turn info</h3><br>')
    new_content.push('  <div class="game-board">');
    // const game_board = game.playout;
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 7; j++) {
            new_content.push('      <button class="game-button white-dot" value="' + j + '" onclick="make_move(this.value)"></button>');
        }
        new_content.push('<br>');
    }
    new_content.push('  </div>');
    new_content.push('  <div class="chat-history-box">')
    new_content.push('  </div>');
    new_content.push('  <div class="chat-box">');
    new_content.push('<input type="text" class="chat-input" style="width: 670px; height: 40px;" ><button class="chat-send-button" onclick="send_message_button()">Send</button>')
    new_content.push('  </div><br>');
    new_content.push('<button class="end-game-button" onclick="end_game()">End game</button>')
    new_content.push('</div>');
    const game_board_content = new_content.join("");
    $('.col-sm-9').append(game_board_content);
}


function send_message_button() {
    const message = $('.chat-input').val();
    $('.chat-input').val("");
    const current_at_room_code = $('.game-page').attr("value");
    if (socket == null) {
        socket = io();
    }
    const message_info = {
        'room_code': current_at_room_code,
        'message': message
    }
    console.log(message_info)
    socket.emit('send_new_message', message_info);
    socket.on('new_message', load_chat_history);
}




function initiate_review_game_board() {
    $('.col-sm-9').empty();
    let new_content = [];
    new_content.push('<div class="game-page">');
    new_content.push('  <div class="game-board">');
    // const game_board = game.playout;
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 7; j++) {
            new_content.push('      <button class="game-button white-dot" value="' + j + '" onclick="make_move(this.value)"></button>');
        }
        new_content.push('<br>');
    }
    new_content.push('  </div>');
    new_content.push('</div>');
    const game_board_content = new_content.join("");
    $('.col-sm-9').append(game_board_content);
}

function end_game() {
    const current_at_room_code = $('.game-page').attr("value");
    if (socket == null) {
        socket = io();
    }
    socket.emit('end_game', current_at_room_code);
}

function review(game_record_id) {
    $.ajax({
        url: "/review_game_record",
        type: "get",
        data: {
            'game_record_id': game_record_id
        },
        success: function (response) {
            $('.col-sm-9').empty();
            initiate_review_game_board();
            load_game_board(response.game_playout);
        },
        error: function (xhr) {
            alert('Query error');
        }
    });
}

function create_game_playout_content(playout) {
    const button_group = [];
    new_content.push('<div class="game-page">');
    new_content.push('</div>');
    return button_group.join("");
}

function start_a_new_game() {
    $('.col-sm-9').empty();
    const button_group = [];
    button_group.push('<div class="button-group">');
    button_group.push('<h3>Game Setting</3><br>');
    button_group.push("<button type='button' class='btn btn-primary game-btn' onclick='start_a_new_random_game()'>Random Game</button>");
    button_group.push("<button  type='button' class='btn btn-primary game-btn' onclick='start_a_new_game_with_friend()'>Game with friends</button>");
    button_group.push('</div>');
    const button_group_content = button_group.join("");
    $('.col-sm-9').append(button_group_content);
}


function start_a_new_game_with_friend() {
    $.ajax({
        url: "/get_all_friends_game",
        type: "get",
        success: function (data) {
            const send_game_request = get_send_game_request(data.game_request, data.username);
            const recieve_game_request = get_recieve_game_request(data.game_request, data.username);
            const active_friend_list_content = create_active_friend_list_content(data.active_friend_list, send_game_request, recieve_game_request);
            $('.col-sm-9').empty();
            $('.col-sm-9').append(active_friend_list_content);
        },
        error: function (xhr) {
            alert("server error");
        }
    });
}

function get_send_game_request(game_request, username) {

    let send_game_request = [];
    if (game_request.length != 0) {
        for (let i = 0; i < game_request.length; i++) {
            if (game_request[i].request_user == username) {
                send_game_request.push(game_request[i]);
            }
        }
    }
    return send_game_request;
}


function get_recieve_game_request(game_request, username) {
    let recieve_game_request = [];
    if (game_request.length != 0) {
        for (let i = 0; i < game_request.length; i++) {
            if (game_request[i].recieve_user == username) {
                recieve_game_request.push(game_request[i]);
            }
        }
    }
    return recieve_game_request;
}

function create_active_friend_list_content(active_friend_list, send_game_request, recieve_game_request) {
    new_content = [];
    new_content.push('<div class="info-div">');
    new_content.push('  <table class="friends-table">');
    new_content.push('      <tbody>');
    new_content.push('          <tr><td style="background-color:lightblue">Active Friends List</td></tr>');
    if (active_friend_list.length != 0) {
        for (let i = 0; i < active_friend_list.length; i++) {
            new_content.push('      <tr><td><a name="' + active_friend_list[i] + '" onclick="send_game_request_to_friend(this.name)">');
            new_content.push(active_friend_list[i])
            new_content.push('      </a></td></tr>');
        }
    } else {
        new_content.push('      <tr><td>No active user can be invited.</td></tr>');
    }
    new_content.push('      <tbody>');
    new_content.push('  </table><br><br>');

    //send game request
    new_content.push('  <table class="friends-table">');
    new_content.push('      <tbody class="sent-game-requests">');
    new_content.push('          <tr><td style="background-color:lightblue" colspan="3">Sent game requests</td></tr>');
    new_content.push('          <tr><td style="background-color:yellow">User Name</td><td style="background-color:yellow">Status</td><td style="background-color:yellow">Action</td></tr>');
    if (send_game_request.length != 0) {
        for (let i = 0; i < send_game_request.length; i++) {
            new_content.push('  <tr>');
            new_content.push('  <td>' + send_game_request[i].recieve_user + '</td><td>' + send_game_request[i].status + '</td>');
            if (send_game_request[i].status == "Pending" || send_game_request[i].status == "Rejected") {
                new_content.push('<td><button value="' + send_game_request[i].recieve_user + '" onclick="delete_sent_game_request(this.value)">Delete</button></td>');
            } else if (send_game_request[i].status == "Accepted") {
                new_content.push('<td><button value="' + send_game_request[i].active_game_room_code +'" onclick="enter_game_with_friend(this.value)">Enter</button></td>');
            }
            new_content.push('  </tr>')
        }
    } else {
        new_content.push('      <tr><td colspan="3">No sent requests</td></tr>');
    }
    new_content.push('      <tbody>');
    new_content.push('  </table><br><br>');

    //recieved game request
    new_content.push('  <table class="friends-table">');
    new_content.push('      <tbody class="recieve-game-requests">');
    new_content.push('          <tr><td style="background-color:lightblue" colspan="3">Recieved game requests</td></tr>');
    new_content.push('          <tr><td style="background-color:yellow">User Name</td><td colspan="2" style="background-color:yellow">Action</td></tr>');
    if (recieve_game_request.length != 0) {
        for (let i = 0; i < recieve_game_request.length; i++) {
            if (recieve_game_request[i].status != "Rejected") {
                new_content.push('  <tr>');
                new_content.push('  <td>' + recieve_game_request[i].request_user + '</td>');
                new_content.push('<td><button value="' + recieve_game_request[i].request_user + '" onclick="reject_game_request(this.value)">Reject</button>');
                new_content.push('<button value="' + recieve_game_request[i].request_user + '" onclick="create_a_game_with_friend(this.value)">Accept</button>');
                new_content.push('  </td></tr>')
            }
        }
    } else {
        new_content.push('      <tr><td colspan="2">No recieved requests</td></tr>');
    }
    new_content.push('      <tbody>');
    new_content.push('  </table>');

    new_content.push('</div>');
    return new_content.join("");
}


function enter_game_with_friend(room_code){
    if (socket == null) {
        socket = io();
    }
    socket.emit('enter_a_friend_game', room_code);
    socket.on('game_ready', display_game_board);
    socket.on('game_in_progress', game_in_progress);
}
function create_a_game_with_friend(target_username) {
    if (socket == null) {
        socket = io();
    }
    socket.emit('start_a_friend_game', target_username);
    socket.on('game_ready', display_game_board);
    socket.on('game_in_progress', game_in_progress);
}


function reject_game_request(requester_name) {
    const recieved_game_request_info = {
        'requester_name': requester_name
    }
    $.ajax({
        method: "POST",
        data: JSON.stringify(recieved_game_request_info),
        contentType: "application/json",
        dataType: "json",
        url: '/reject_recieved_game_request',
    }).done(function (result) {
        alert("Your game request to " + result.reciever_name + " has been deleted");
        start_a_new_game_with_friend();
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert('Unable to sent the request');
    });
}

function delete_sent_game_request(reciever_name) {
    const sent_game_request_info = {
        'reciever_name': reciever_name
    }
    $.ajax({
        method: "POST",
        data: JSON.stringify(sent_game_request_info),
        contentType: "application/json",
        dataType: "json",
        url: '/delete_sent_game_request',
    }).done(function (result) {
        alert("Your game request to " + result.reciever_name + " has been deleted");
        start_a_new_game_with_friend();
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert('Unable to sent the request');
    });
}




function send_game_request_to_friend(username) {
    const request_info = {
        'target_username': username
    }
    $.ajax({
        method: "POST",
        data: JSON.stringify(request_info),
        contentType: "application/json",
        dataType: "json",
        url: '/send_game_request',
    }).done(function (result) {
        alert("you sent a game request to " + username);
        start_a_new_game_with_friend();
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert('Unable to sent the request');
        friends_button();
    });
}






function start_a_new_random_game() {
    $.ajax({
        url: "/user_satatus",
        type: "get",
        success: function (response) {
            const user_status = response.user_status;
            if (user_status === MATCHING) {
                $('.col-sm-9').empty();
                $('.col-sm-9').append("<h3 style='padding-top:25%; padding-left: 15%;'>You have already started a new game.<br><br> Please wait, system is matching a game for you.</h3>");
            } else {
                $('.col-sm-9').empty();
                const button_group = [];
                button_group.push('<div class="button-group">');
                button_group.push('<h3>Game Setting</3><br>');
                button_group.push("<button type='button' class='btn btn-primary game-btn' onclick='start_a_random_game_request(this.value)' value='public'>Public</button>");
                button_group.push("<button  type='button' class='btn btn-primary game-btn' onclick='start_a_random_game_request(this.value)' value='friends'>Friends Only</button>");
                button_group.push("<button  type='button' class='btn btn-primary game-btn' onclick='start_a_random_game_request(this.value)' value='private'>Private</button>");
                button_group.push('</div>');
                const button_group_content = button_group.join("");
                $('.col-sm-9').append(button_group_content);
            }
        },
        error: function (xhr) {
            alert('Query error');
        }
    });
}

function start_a_random_game_request(game_privacy) {
    if (socket == null) {
        socket = io();
    }
    socket.emit('start_a_new_random_game', game_privacy);
    socket.on('matching', function () {
        $('.col-sm-9').empty();
        $('.col-sm-9').append("<h3 style='padding-top:25%; padding-left: 15%;'>Please wait, system is matching a game for you.</h3>");
    });
    socket.on('found_match', prepare_the_game);
};


function prepare_the_game(game) {
    game_button()
    $('.col-sm-9').empty();
    $('.col-sm-9').append("<h3 style='padding-top:25%; padding-left: 15%;'>We found you a match, game is about to start</h3>");
    setTimeout(function () {
        socket.emit('ready_for_game');
        display_game_board(game);
    }, 5000);
}


function display_game_board(game) {
    initiate_game_board(game.room_code);
    socket.emit('game_start', game);
    socket.on('game_in_progress', game_in_progress);
    socket.on('game_end', function (data) {
        load_game_board(data.final_state)
        alert("Game end, Winner is: " + data.winner_name);
        $('.game-button').prop("disabled", true);
        $('.game-page h3').empty();
        $('.game-page h3').append("Game end");
        $('.chat-history-box').hide();
        $('.chat-box').hide();
        $('.end-game-button').hide();
    });
    socket.on('new_message', load_chat_history);
}

function make_move(column) {
    const room_code = $('.game-page').attr("value");
    move = {
        'room_code': room_code,
        'column': column
    }
    socket.emit('make_move', move);
}


function game_in_progress(game) {
    const current_at_room_code = $('.game-page').attr("value");
    if (current_at_room_code == game.room_code) {
        $.get('/client_session_info', function (data) {
            const current_turn_user = game.current_turn;
            const current_session_username = data.session_username;
            const sepectate_check = check_sepectate_status(game.players, current_session_username);
            //load board info 
            const game_board = game.playout;
            $('.game-board').empty();
            load_game_board(game_board)
            //load turn info
            if (sepectate_check) {
                $('.game-page h3').empty();
                $('.game-page h3').append("Your are spectating. Yellow is: " + game.yellow + ", Blue is " + game.blue);
                $('.game-button').prop("disabled", true);
                $('.end-game-button').hide();
            } else {
                if (current_session_username == current_turn_user) {
                    $('.game-page h3').empty();
                    $('.game-page h3').append("Your Turn");
                    $('.game-button').prop("disabled", false);
                } else {
                    $('.game-page h3').empty();
                    $('.game-page h3').append("Opponent Turn");
                    $('.game-button').prop("disabled", true);
                }
            }
            //load chat history
            const chat_history = game.chat_history;
            load_chat_history(chat_history)
        }).fail(function () {
            alert('Internal System error');
        });
    }
}

function check_sepectate_status(players, username) {
    let check = true;
    for (let i = 0; i < players.length; i++) {
        if (players[i] == username) {
            check = false;
            return check;
        }
    }
    return check;
}


function load_chat_history(chat_history) {
    if (chat_history.length != 0) {
        $('.chat-history-box').empty();
        for (let i = 0; i < chat_history.length; i++) {
            $('.chat-history-box').append(chat_history[i].username + ": " + chat_history[i].message_content + "<br>");
        }
        var box = $('.chat-history-box');
        box.scrollTop = box.scrollHeight;

    }
}



function load_game_board(game_board) {
    $('.game-board').empty();
    for (let i = 0; i < game_board.length; i++) {
        for (let j = 0; j < game_board[i].length; j++) {
            if (game_board[i][j] == WHITE) {
                $('.game-board').append('<button class="game-button white-dot" value="' + j + '" onclick="make_move(this.value)"></button>');
            } else if (game_board[i][j] == YELLOW) {
                $('.game-board').append('<button class="game-button yellow-dot" value="' + j + '" onclick="make_move(this.value)"></button>');
            } else if (game_board[i][j] == BLUE) {
                $('.game-board').append('<button class="game-button blue-dot" value="' + j + '" onclick="make_move(this.value)"></button>');
            }
        }
        $('.game-board').append('<br>');
    }
}

function continued_an_actived_game() {
    $.get('/continue_active_games', function (data) {
        const user_active_games = data.user_active_games;
        const username = data.username
        $('.col-sm-9').empty();
        const active_game_content = create_active_game_content(user_active_games, username);
        $('.col-sm-9').append(active_game_content)
    }).fail(function () {
        alert('Internal System error');
    });
}

function create_active_game_content(active_games, username) {
    new_content = [];
    new_content.push('<div class="info-div">');
    new_content.push('  <table class="friends-table">');
    new_content.push('      <tbody>');
    new_content.push('          <tr><td style="background-color:lightblue" colspan="3">Active Games List</td></tr>');
    new_content.push('          <tr><td style="background-color:yellow;">Opponent</td><td style="background-color:yellow;">Turn info</td><td style="background-color:yellow;">Action</td></tr>');
    if (active_games.length != 0) {
        for (let i = 0; i < active_games.length; i++) {
            new_content.push('  <tr>');
            const opponent_name = get_opponent_name(active_games[i], username);
            new_content.push('      <td>' + opponent_name + '</td>');
            const turn_check = check_turn(username, active_games[i]);
            if (turn_check) {
                new_content.push('<td>Your turn</td>');
            } else {
                new_content.push('<td>Opponent turn</td>');
            }
            new_content.push('  <td>');
            new_content.push('      <button value="');
            new_content.push(active_games[i].room_code);
            new_content.push('" onclick=continue_game(this.value)>Back game</button>');
            new_content.push('          </td>');
            new_content.push('  </tr>');
        }
    } else {
        new_content.push('<tr><td colspan="3">No active games</td></tr>')
    }
    new_content.push('      <tbody>');
    new_content.push('  </able>');
    new_content.push('</div>');
    return new_content.join("");

}


function continue_game(room_code) {
    initiate_game_board(room_code);
    if (socket == null) {
        socket = io();
    }
    socket.emit('back_game', room_code);
    socket.on('game_in_progress', game_in_progress);
}






$(document).ready(function () {
    $('.col-sm-9').empty();
    const button_group = [];
    button_group.push('<div class="button-group"> ');
    button_group.push("<button type='button' class='btn btn-primary game-btn' onclick='start_a_new_game()'>Start a new game</button>");
    button_group.push("<button  type='button' class='btn btn-primary game-btn' onclick='continued_an_actived_game()'>Continued an actived game</button>");
    button_group.push('</div>');
    const button_group_content = button_group.join("");
    $('.col-sm-9').append(button_group_content);

});