var fs = require('fs');
var path = require('path');
var url = require('url');
var loc = __dirname + '/data/';


function errorHandler(err) {
	console.log(err);
}



// view all existing file in data directory
exports.index = function(req,res) {
	countJSONFile();
	setTimeout(function() {
		res.send('you have '+ fileCount +' JSON files in your data folder' + jsonFile);
		}, 10);
};

// view a specific file in the data directory
exports.viewFile = function(req, res) {
	var filepath = loc + req.params.fileName;
	console.log(filepath);
	fs.readFile(filepath, function(err, data) {
		if (err) {
			errorHandler(err);
			res.writeHead(500, {'Content-Type':'text/plain'});
			res.write('could\'t locate the file');
			res.end();
		}
		else {
			console.log('reading file');
			console.log(JSON.parse(data));
			res.send(JSON.parse(data));
		}
	})
};


// create a file
exports.createFile = function(req, res) {
	countJSONFile();
	setTimeout(function() {
		var filePath = loc + 'file_' + (fileCount + 1) + '.json';
		fs.writeFile(filePath, JSON.stringify(req.body), function(err) {
			if (err) errorHandler(err);
			else {
//				console.log(req.body);
				fileCount ++;
				console.log('file is saved in json format');
			}
		res.redirect('/api/post');
		});
	}, 10);
}

exports.updateFile = function(req, res) {
	var filePath = loc + req.params.fileName;
	fs.writeFile(filePath, JSON.stringify(req.body), function(err) {
		if (err) errorHandler(err);
		else {
				console.log('file is updated');
		}
	res.redirect('/api/post');
	});
};

exports.deleteFile = function(req, res) {
	var fileName =  req.params.fileName;
	var filepath = loc + fileName;
	console.log(filepath);
	fs.unlink(filepath, function(err) {
		if (err) errorHandler(err);
		else {
			res.send('The file: ' + fileName + ' is delted.');
//			res.redirect('/api/post');
		}
	})
};

exports.countJSONFile = countJSONFile;