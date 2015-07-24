var express = require('express');
var app = express();
var mongoose = require('mongoose');
var port = process.env.PORT || 8080;

mongoose.connect(process.env.mongo_uri || 'mongodb://localhost/rest_aws_s3')


var apiRouter = express.Router ();
require('./router/user_router.js')(apiRouter);

app.use('/api', apiRouter);

//app.use(function(req, res, next) {
//	console.log('Request comes in for ' + url.parse(req.url).path + ' at time: ' + new Date().toString());
//	next();
//})

app.listen(port, function() {
	console.log('server is on ' + port);
});

