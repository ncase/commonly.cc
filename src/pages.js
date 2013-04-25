module.exports = function(app){

	app.get('/', function(request, response){
		response.redirect('/projects');
	});

	app.get('/about', function(request, response){
		response.send("I'll fill out this page when I get to it.");
	});

};