var https = require("https"),
    url = require("url");

var defaultOptions = {
  audience: "",
  logoutPath: "/persona/logout",
  sessionKey: "email",
  verifierURI: "https://verifier.login.persona.org/verify",
  verifyPath: "/persona/verify",
  verifyResponse: function(error, req, res, email) {
    var out;
    if (error) {
      out = { status: "failure", reason: error };
    } else {
      out = { status: "okay", email: email };
    }
    res.json(out);
  },
  logoutResponse: function(error, req, res) {
    var out;
    if (error) {
      out = { status: "failure", reason: error };
    } else {
      out = { status: "okay" };
    }
    res.json(out);
  }
};

var account = {};

var app;
account.init = function(_app, options) {
  app = _app;
  options = options || {};

  var personaOpts = {};
  Object.keys(defaultOptions).forEach(function(key) {
    if (typeof options[key] === typeof defaultOptions[key]) {
      personaOpts[key] = options[key];
    } else {
      personaOpts[key] = defaultOptions[key];
    }
  });

  // Use our own https agent that rejects bad SSL certs
  var verifierOpts = url.parse(personaOpts.verifierURI);
  verifierOpts.method = "POST";
  verifierOpts.rejectUnauthorized = true;
  verifierOpts.agent = new https.Agent(verifierOpts);

  app.post(personaOpts.verifyPath, function(req, res) {
    // If the bodyParser middleware hasn't been used() then we can't get the assertion
    if (!req.body) {
      personaOpts.verifyResponse("Server-side exception", req, res);
    }

    var vreq = https.request(verifierOpts, function(verifierRes) {
      var body = "";

      verifierRes.on("error", function(error) {
        personaOpts.verifyResponse("Server-side exception", req, res);
      });

      verifierRes.on("data", function(chunk) {
        body = body + chunk;
      });

      // Match the Persona Remote Verification API's return values
      // https://developer.mozilla.org/en-US/docs/Persona/Remote_Verification_API#Return_values
      verifierRes.on("end", function() {
        try {
          var response = JSON.parse(body),
              valid = response && response.status === "okay";

          if (valid) {
            if (req.session) {
              req.session[personaOpts.sessionKey] = response.email;
            }


            // YOU'RE LOGGED IN. CREATE NEW ACCOUNT?...
            // Woop woop
            app.connectDatabase( function(err, db) {

                if(err) { return console.dir(err); }

                var params = {
                    email: response.email
                };

                // Insert new entry
                var collection = db.collection('accounts');
                collection.find({email:params.email}).toArray( function(err,items){

                    if(items.length==0){

                        // New Account
                        collection.insert( params, function(err,inserted){
                            if(err) { return console.dir(err); }
                            req.session.user = inserted[0];
                            personaOpts.verifyResponse(null, req, res, response.email);
                        });
                        
                    }else{
                        
                        // Existing Account
                        req.session.user = items[0];
                        personaOpts.verifyResponse(null, req, res, response.email);

                    }

                });

            });



          } else {
            personaOpts.verifyResponse(response.reason, req, res);
          }

        } catch (e) {
          personaOpts.verifyResponse("Server-side exception", req, res);
        }
      });
    });
    // SSL validation can fail, which will be thrown here
    vreq.on("error", function(error) {
      personaOpts.verifyResponse("Server-side exception", req, res);
    });
    vreq.setHeader("Content-Type", "application/json");
    var data = JSON.stringify({
      assertion: req.body.assertion,
      audience: req.host
    });
    vreq.setHeader("Content-Length", data.length);
    vreq.end(data);
  });

  app.post(personaOpts.logoutPath, function(req, res) {
    if (req.session) {
      req.session[personaOpts.sessionKey] = null;
    }

    // YOU'RE LOGGED OUT.
    req.session.user = null;
    personaOpts.logoutResponse(null, req, res);

  });
};

account.updateUser = function(user,params,callback){

    app.connectDatabase( function(err, db) {

        if(err) { return console.dir(err); }

        // Update entry
        var collection = db.collection('accounts');

        collection.update(

            { email:user.email },
            { $set:params },
            { safe:true },

            function(err){

                if(err){
                    console.log(err.message);
                    callback(err,user);
                }else{

                    // Update session user, too.
                    for(var key in params){
                        user[key] = params[key];
                    }

                    callback(null,user);

                }

            }

        );

    });    

};


module.exports = account;