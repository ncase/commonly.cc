var ObjectID = require('mongodb').ObjectID;
var SendGrid = require('sendgrid').SendGrid;
var sendgrid = new SendGrid( process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD );

module.exports = function(app){

	app.get('/buy/:id', function(request, response){

		app.connectDatabase(function(err, db) {
            
            if(err) { return console.dir(err); }

    		db.collection('projects').find({
    			_id: new ObjectID(request.params.id)
    		}).toArray(function(err,results){

                if(err) { return console.dir(err); }

    			var project = results[0];
    			response.render('debug/Paypal.ejs',{
    				project: project,
	    			hostname: request.host
	    		});
                
    		});

    	});

	});

	app.get('/transactions', function(request, response){
		app.connectDatabase(function(err, db) {
            if(err) { return console.dir(err); }
    		db.collection('transactions').find().toArray(function(err,results){
                if(err) { return console.dir(err); }
    			response.send(JSON.stringify(results));
    		});
    	});		
	});

	app.post('/transactions/paypal/ipn', function(request, response){
		
        var params = request.body;
        response.end(); // Response doesn't actually matter

        app.connectDatabase( function(err, db) {

            if(err) { return console.dir(err); }

            // Parse custom variables
            try{
                params.custom = JSON.parse(params.custom);
            }catch(err){
                console.dir(err);
                params.custom = {};
            }

            // Insert new Transaction Entry
            // Not duplicated transaction
            var collection = db.collection('transactions');
            collection.ensureIndex( {txn_id:1}, {unique:true}, function(err){
                if(err) { return console.dir(err); }
                collection.insert( params, function(err,inserted){
                    if(err) { return console.dir(err); }

                    // Find project
                    db.collection('projects').find({
                        _id: new ObjectID(params.custom.project_id)
                    }).toArray(function(err,projects){
                        
                        // Send Email
                        var project = projects[0];
                        var url = "http://"+request.host+"/projects/"+project.username+"/"+project.url_title+"?tx="+params.txn_id;
     
                        sendgrid.send({
                  
                            to: params.custom.email,
                            from: 'nick@commonly.cc',
                            subject: 'Thank you!',
                            text: 'Thanks, here is your download url, sweetie: '+url

                        }, function(success, message) {
                            if(!success) console.log(message);
                        });


                    });                

                });
            });

        });

	});

};