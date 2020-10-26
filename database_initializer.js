const mongoose = require('mongoose');
const User = require("./Model/UserModel")


mongoose.connect('mongodb://127.0.0.1/connect4_db', {
	useNewUrlParser: true
});
let db = mongoose.connection;

db.on('error', console.error.bind(console, 'database connection error'));
db.once('open', function(){
    mongoose.connection.db.dropDatabase(function(err, result){
        if(err){
            console.log("Error dropping database:");
            console.log(err);
            return;
        };
        let admin_user = new User();
        admin_user.username = "admin";
        admin_user.password = "admin1";
        admin_user.save(function(err,result){
            if(err){
                console.log("Error creatring admin user");
                console.log(err.message);
                return;
            };
            console.log("Databse initialization complete, super username: 'admin', super userpassword: 'admin1'.");
            mongoose.connection.close();
        });
    });
});