var ObjectID = require('mongodb').ObjectID;
var sunny = require("sunny").Configuration.fromEnv();

module.exports = function(app){

    //////////////////
    // CREATING & EDITING
    //////////////////

    app.get('/projects/new', function(request, response){

        // Are you logged in w username
        var user = request.session.user;
        if(!user || !user.username){
            response.redirect("/account");
            return;
        }

        // New Project

        var newProject = {

            _id: -1,

            title: "New Project",
            url_title: null,
            blurb: "Your crowdfunding ransom",
            
            banner: "http://placekitten.com/960/300",
            username: user.username,

            goal: 0,
            asset: null,
            preview: "",

            live: false
            
        };  

        response.render('project/ProjectEdit.ejs',{
            project: newProject
        });

    });

    app.get('/projects/edit/:id', function(request, response){

        var id = request.params.id;

        // Are you logged in w username
        var user = request.session.user;
        if(!user || !user.username){
            response.redirect("/account");
            return;
        }

        // Make sure you OWN THIS!
        app.connectDatabase( function(err, db) {
            if(err) { return console.dir(err); }

            db.collection('projects').find({
                
                _id: new ObjectID(id)

            }).toArray(function(err,projects){
                if(err) { return console.dir(err); }
                var project = projects[0];

                // You OWN this project!
                if(project.username != user.username){
                    response.send("oy. you don't own this project.");
                    return;
                }

                response.render('project/ProjectEdit.ejs',{
                    project: project
                });

                db.close();

            });
        });

    });



    //////////////////
    // SERVER SIDE LOGIC
    //////////////////

    app.post('/projects/update', function(request, response){

        // Are you logged in w username
        var user = request.session.user;
        if(!user || !user.username){
            response.send("Account not signed in or created yet.");
            return;
        }

        // ID
        var _id = request.body._id;
        var query = {};
        var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$");
        if(checkForHexRegExp.test(_id)){
            query._id = new ObjectID(_id);
        }

        // CHECK: You actually OWN THIS DAMN PROJECT
        // CHECK: This project has not already been published
        app.connectDatabase( function(err, db) {
            if(err) { return console.dir(err); }

            db.collection('projects').find(query).toArray(function(err,projects){
                if(err) { return console.dir(err); }
                var originalProject = projects[0];

                // Project already exists, then check you OWN this project
                if(originalProject && originalProject.username!=user.username){
                    response.send("You don't own this project");
                    return;
                }

                // Name & URL-safe Name: Alphanumerics with Hyphens.
                var title = request.body.title.trim();
                var url_title = title.toLowerCase().replace(/[^a-z0-9\s]/g,"").replace(/\s/g,"-");

                // Metainfo
                var blurb = request.body.blurb;

                // Preview URL
                var previewURL = request.body.preview;

                // Variables you can't change if it's published
                var LIVE_LOCKED = (originalProject && !!originalProject.live);
                if(!LIVE_LOCKED){

                    // Funding Goal
                    var goal = parseFloat(request.body.goal);
                    if(goal<0) return;

                    // Live
                    var live = !!request.body.live; // Force to boolean

                }

                // TODO: Check that all necessary vars are in if livelocked.
                
                // Upload Files
                var bucket = process.env.SUNNY_BUCKET;
                var bucketRequest = sunny.connection.getContainer(bucket);
                bucketRequest.on('end', function(results,meta){
                    
                    var container = results.container;
                   
                    // Write images
                    function uploadFile(file,originalURL,lockFlag,callback){

                        if(!lockFlag && file.size>0){

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

                        }else{
                            callback(originalURL);
                        }

                    }

                    // Upload both files
                    uploadFile( request.files.banner, request.body.banner_original, false, function(bannerURL){
                        uploadFile( request.files.asset, request.body.asset_original, LIVE_LOCKED, function(assetURL){

                            var entry = {

                                title: title,
                                url_title: url_title,
                                blurb: blurb,
                                
                                banner: bannerURL,
                                username: user.username,

                                goal: goal,
                                asset: assetURL,
                                preview: previewURL,

                                live: live
                                
                            };

                            // UPSERT PROJECT in Database
                            db.collection('projects').update( query, entry, {upsert:true}, function(err,inserted){
                                if(err) { return console.dir(err); }

                                // Finally Respond
                                response.redirect('/projects/'+entry.username+'/'+entry.url_title);
                                db.close();

                            });

                        });
                    });
                    
                });
                bucketRequest.end();

            });
        });

    });



    //////////////////
    // VIEW PROJECTS
    //////////////////

    var renderProjects = function(response,query,options){

        options = options || {};
        var buyerTransaction = options.transaction;
        var username = options.user ? options.user.username : null;

        app.connectDatabase( function(err, db) {
            if(err) { return console.dir(err); }

            db.collection('projects').find(query).sort({_id:-1}).toArray(function(err,projects){
                if(err) { return console.dir(err); }
                
                db.collection('transactions').find().toArray(function(err,transactions){
                    if(err) { return console.dir(err); }

                    for(var i=0;i<projects.length;i++){
                        
                        var project = projects[i];

                        // You are the creator
                        project.isCreator = (project.username==username);

                        // Remove project if it's not live, and you're not the creator
                        if(!project.live && !project.isCreator){
                            projects.splice(i);
                            i--;
                            continue;
                        }

                        // Project funding
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
        renderProjects(
            response,
            {
                username: request.params.username
            },
            {
                user: request.session.user
            }
        );
    });
    app.get('/projects/:username/:url_title', function(request, response){
        renderProjects(
            response,
            {
                username: request.params.username,
                url_title: request.params.url_title
            },
            {
                transaction: request.query.tx,
                user: request.session.user
            }
            // To do: a COMPLETELY different view when you're buyer, so it knows to also give you a confirmation message
        );
    });

};