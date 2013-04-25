var sunny = require("sunny").Configuration.fromEnv();

module.exports = function(app){

    //////////////////
    // CREATE

    app.get('/projects/new', function(request, response){

        // Are you logged in w username
        var user = request.session.user;
        if(!user || !user.username){
            response.redirect("/account");
            return;
        }

    	response.render('project/ProjectCreate.ejs');

    });
    app.post('/projects/create', function(request, response){

        // Are you logged in w username
        var user = request.session.user;
        if(!user || !user.username){
            response.send("Account not signed in or created yet.");
            return;
        }

        // Name & URL-safe Name: Alphanumerics with Hyphens.
        var title = request.body.title.trim();
        var url_title = title.toLowerCase().replace(/[^a-z0-9\s]/g,"").replace(/\s/g,"-");

        // Metainfo
        var blurb = request.body.blurb;

        // Funding Goal
        var goal = parseFloat(request.body.goal);
        if(goal<0) return;
        
        // Upload Files
        var bucket = process.env.SUNNY_BUCKET;
        var bucketRequest = sunny.connection.getContainer(bucket);
        bucketRequest.on('end', function(results,meta){
            
            var container = results.container;
            console.log("GET container: "+container.name);
           
            // Write images
            function uploadFile(file,callback){

                var filepath = file.path;
                var filename = (Math.random().toString(36).substr(2)) + "_" + file.name;
                var filetype = file.type;

                var uploadRequest = container.putBlobFromFile( filename, filepath, {
                    headers: { "Content-Type":filetype }
                });

                uploadRequest.on('end', function (results, meta) {
                    var url = "http://"+process.env.SUNNY_AUTH_URL+"/"+bucket+"/"+filename;
                    callback(url);
                });

                uploadRequest.end();

            }

            // Upload both files
            uploadFile( request.files.banner, function(bannerURL){
                uploadFile( request.files.asset, function(assetURL){

                    var entry = {
                        title: title,
                        url_title: url_title,
                        blurb: blurb,
                        banner: bannerURL,
                        goal: goal,
                        asset: assetURL,
                        username: user.username
                    };

                    app.connectDatabase( function(err, db) {
                        if(err) { return console.dir(err); }

                        db.collection('projects').insert( entry, function(err,inserted){
                            if(err) { return console.dir(err); }

                            // Finally Respond
                            var json = JSON.stringify(inserted[0]);
                            console.log("Created Project: "+json);
                            db.close();

                            response.redirect('/projects/'+entry.username+'/'+entry.url_title);

                        });
                    });

                });
            });
            
        });
        bucketRequest.end();

    });

    //////////////////
    // VIEW PROJECTS

    var renderProjects = function(response,query,buyerTransaction){

        app.connectDatabase( function(err, db) {
            if(err) { return console.dir(err); }

            db.collection('projects').find(query).sort({_id:-1}).toArray(function(err,projects){
                if(err) { return console.dir(err); }
                
                db.collection('transactions').find().toArray(function(err,transactions){
                    if(err) { return console.dir(err); }

                    for(var i=0;i<projects.length;i++){
                        var project = projects[i];
                        project.isBuyer = false;
                        project.funding = transactions.reduce( function(value,transaction){

                            if(transaction.custom.project_id==project._id){
                                if(transaction.txn_id==buyerTransaction){
                                    project.isBuyer = true;
                                }
                                return value + parseFloat(transaction.mc_gross);
                            }else{
                                return value;
                            }

                        },0);
                    }

                    response.render('project/ProjectView.ejs',{
                        projects: projects
                    });

                });
            });
        });

    };

    app.get('/projects', function(request,response){
        renderProjects(response);
    });
    app.get('/projects/:username', function(request, response){
        renderProjects(response,{
            username: request.params.username
        });
    });
    app.get('/projects/:username/:url_title', function(request, response){
        renderProjects(
            response,
            {
                username: request.params.username,
                url_title: request.params.url_title
            },
            request.query.tx
            // To do: a COMPLETELY different view when you're buyer, so it knows to also give you a confirmation message
        );
    });

};