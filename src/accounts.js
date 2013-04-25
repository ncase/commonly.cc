module.exports = function(app){

	// Mozilla Persona
	var persona = require("./persona");
	persona.init(app);

	////////////////
	// Create Account

	app.get('/account',function(request,response){
		response.render('account/AccountView.ejs',{
			user: request.session.user
		});
	});
	app.post('/account/create',function(request,response){

		var params = request.body;
		var user = request.session.user;
		if(!user){
			response.send("Persona Account not connected. Try again.");
			return;
		}

		persona.updateUser(user,{
			
			username: params.username,
			paypal: params.paypal

		}, function(){
			response.redirect("/account");
		});

	});

	////////////////
	// View Userpage
	
	app.get('/user/:username',function(request,response){

		app.connectDatabase(function(err, db) {
			if(err) { return console.dir(err); }

    		db.collection('accounts').find({
    			username: request.params.username
    		}).toArray(function(err,results){
    			if(err) { return console.dir(err); }

    			var user = results[0];
    			var avatar = getGravatar(user.email);
    			response.send( JSON.stringify(user) + "<br> <img src='"+avatar+"'>" );
    			
    		});
    	});

	});

};

// GRAVATAR SHTUFF
var crypto=require('crypto'), querystring=require('querystring');
var getGravatar = function (email, options) {
	var baseURL = 'http://www.gravatar.com/avatar/';
	var queryData = querystring.stringify(options);
	var query = (queryData && "?" + queryData) || "";
	return baseURL + crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex') + query;
};