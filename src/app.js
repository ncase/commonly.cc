// Init Express
var express = require('express');
var app = express();
app.use('/', express.static('./static'));
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret:process.env.SESSION_SECRET}));

// Init Database
var mongo = require('mongodb').MongoClient,
    mongoURI = process.env.MONGO_URI;
app.connectDatabase = function(callback){
	mongo.connect(mongoURI,callback);
};

// Init Modules
require('./pages')(app);
require('./projects')(app);
require('./accounts')(app);
require('./transactions')(app);

// Hey, Listen.
var port = process.env.PORT || 80;
app.listen(port);
console.log('Express server started on port '+port);