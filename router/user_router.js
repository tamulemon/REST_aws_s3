//GET /users - done
//
//POST /users - done
//
//GET /users/:user - done
//
//PUT /users/:user (rename a user and user's bucket) - done
//
//DELETE /users/:user - done
//
//GET /user/:user/files - done
//
//POST /user/:user/files - done
//
//GET /user/:user/files/:file
//
//PUT /user/:user/files/:file (replace an already existing file, or update it somehow. 
//
//DELETE /user/:user/files (deletes all files. 

// {"fileName": "fileOne": "content": "hello world!"}

// binary data

// http://s3-aws-region.amazonaws.com/bucket
var express = require('express');
var bodyParser = require('body-parser');
var User = require('../model/user.js');
var File = require('../model/file.js');
var AWS = require('aws-sdk');

// because everyone is going to share the same bucket, this is hardcoded here
var bucketName = process.env.Bucket || '55b13a28b651c557054eb832';

var s3 = new AWS.S3();

var awsRegion = 'us-east-1';

module.exports = function(router) {
	router.use(bodyParser.json());
	
	router.route('/users')
	.get(function(req, res) {
		// display all users
		User.find({}, function(err, users) {
			if (err) {
				res.json(errorHandler(err)('load users'));
			}
			else {
				res.json(users);
			}
		})
	})
	.post(function(req, res) {
		// create a new user. a folder for this user is not created at this point. a bucket is also not created because users are sharing the same bucket
		var user = new User(req.body); 	
		user.save(function(err, userData) {
			if(err) { 
				res.json(errorHandler(err)('create user. user already exist'));
			}
			else {
				res.json({msg: 'user is created'});
			}		
		});	
	});
	
	router.route('/users/:user/') 
	// get all information about a user
	.get(function(req, res) {
		fetchUser(req, res, function(err, user) {
			res.json(user);
		});
	})
	.put(function(req, res) {	
	// update a user's name and update his online folder name
		var oldUserName = req.params.user,
				newUserName = req.body.name;	
		fetchUser(req, res, function(err, user) {
			user.name = newUserName;
			user.save();
			returnAwsFilesByUser(oldUserName, function(error, data) {
				if(error) {
					res.json(errorHandler(err)('update user name'));
				} 
				else{ 
					var fileCompleted = 0; 
					var total = data.length; // need to cash data.length here because there is another 'data' variable in callback scope
					var urlParams, AWSurl;
					data.forEach(function(file) {
						var oldParams = new setCopyParams(bucketName, file);
						var fileName = file.Key.split('/').pop();
						var newParams = new setParams(bucketName, newUserName + '/' + fileName);
						var deleteParams = new setDelteParams(bucketName, file);
						copy_put_delete_AwsFile(oldParams, newParams, deleteParams, function(er, data) {
							if (er) {
								res.json(errorHandler(err)('update user name'));
							} else {
								urlParams = new setUrlParams(bucketName, newUserName + '/' + fileName);
								AWSurl = s3.getSignedUrl('getObject', urlParams);
//								console.log(user.file);
//								console.log(AWSurl);
								for (var i = 0; i < user.file.length; i++) {
									var fileToUpdate = user.file[i];
//									console.log(fileToUpdate, fileName);
									if (fileToUpdate.name === fileName) {
//										console.log(user.file._id);
										File.update({_id: fileToUpdate._id}, {$set: {url: AWSurl}}, function(err, data) {
											if(err) errorHandler(err)('update file url');
											else {
												fileCompleted ++;
												if (fileCompleted === total) res.json({msg:'user name and file update completed'});
											}
										});
										break; // file name uniqiue to each user
									}
								}
							}
						})
					})
				}
			})
		})
	})
//		User.update({name: oldUserName}, {$set:{name: newUserName}}, function(err, user) {
//			if (err) {
//				res.json(errorHandler(err)('update user'));
//			} 
//		
//			else {
//				returnAwsFilesByUser(oldUserName, function(error, data) {
//					if(error) {
//						res.json(errorHandler(err)('update user name'));
//					} 
//					else{ 
//						var fileCompleted = 0; 
//						// have to implement a total count to dictate when to send response message. because there is a loop here, if the res.json is put within the last call back , the first file completed will trigger res.json, and the following will have an error: couldn't set header when response is send
//						var total = data.length; // need to cash data.length here because there is another 'data' variable in callback scope
//						data.forEach(function(file) {
//							var oldParams = new setCopyParams(bucketName, file);
//							var newParams = new setParams(bucketName, newUserName + '/' + file.Key.split('/').pop());
//							var deleteParams = new setDelteParams(bucketName, file);
//							copy_put_delete_AwsFile(oldParams, newParams, deleteParams, function(er, data) {
//								if (er) {
//									res.json(errorHandler(err)('update user name'));
//								} else {
//									fileCompleted ++;
////									var urlParams = new setUrlParams(bucketName, user.name + '/' + req.body.fileName);
////									var AWSurl = s3.getSignedUrl('getObject', urlParams);
////									var newFile = new File({name: req.body.fileName, url: AWSurl});
////									newFile.save(function(error, data) {
//									if (fileCompleted === total) res.json({msg:'user name and file update completed'});	
//								}
//							});
//						});
//					}
//				})
//			}
//		})
//	})
	.delete(function(req, res) {
	// delete a user and his folder and all his files
		User.remove({name: req.params.user}, function(err, user) {
			if (err) {
				res.json(errorHandler(err)('delete user'));
			}
			else {
				returnAwsFilesByUser(req.params.user, function(err, data) {
					if(err) {
						res.json(errorHandler(err)('delete user'));
					} else {
						var fileCompleted = 0;
						var total = data.length;
						data.forEach(function(file) {
						var deleteParams = new setDelteParams(bucketName, file);
							s3.deleteObject(deleteParams, function(err, data) {
								if(err) return console.log('couldn\'t delete the file', err);
								console.log('user folder is deleted from aws');
								fileCompleted ++;
								if (fileCompleted === total) res.json({msg: 'user/user folder/files are all deleted'});
							})
						})
					}
				})
			}
		})
	})

	
	router.route('/users/:user/files')
	.get(function(req, res) {
		fetchUser(req, res, function(err, user) {
			var fileOutput = {};
			user.file.forEach(function(one) {
				fileOutput[one.name] = one.url;
			})
			res.json({name: user.name, file: fileOutput});
		})
	})
	.post(function(req, res) {
		fetchUser(req, res, function(err, user) {
			var params = new setPutParams(bucketName, user.name + '/' + req.body.fileName, req.body.content);
			s3.putObject(params, function(error, data) {
			 if (error) {
				res.json(errorHandler(err)('load users'));
			 }
				console.log('Saving file to aws');
			});
			var urlParams = new setUrlParams(bucketName, user.name + '/' + req.body.fileName);
			var AWSurl = s3.getSignedUrl('getObject', urlParams);
			var newFile = new File({name: req.body.fileName, url: AWSurl});
			newFile.save(function(error, data) {
				if (error) {
				 res.json(errorHandler(err)('save reference to file'));
					} 
				user.update({$push: {file: data._id}}, function(err) {
					if (error) {
					 res.json(errorHandler(err)('save updated file to user'));
					}
					console.log('saving file to user');
					res.json({msg: 'file is saved'});
				})
			})
		})
	})
	.delete(function(req, res) {
		User.update({name: req.params.user}, {$set:{file: []}}, function(err, user) {
			if (err) {
				res.json(errorHandler(err)('delete files of user'));
			} 
			else if (!user) {
				res.send({msg:'couldn\'t find user'});
			}
			else {
				console.log('more');
			}
	})
	})

//	router.route('/users/:user/files/:file')
//	.get(function(req, res) {
//
//			});
//	
//	})
//	.put()
//	.delete()
};

//
					

function errorHandler(error) {
	console.log(error);
	return function(message){
	return ({status: 500, msg: "server error, couldn't " + message});
	}
}

function setParams(bucket, key) {
	this.Bucket = bucket;
	this.Key = key;
}

function setListParams(bucket, prefix) {
	this.Bucket = bucket;
	this.Prefix = prefix;
}

function setPutParams(bucketName, key, body) {
	this.Bucket = bucketName;
	this.Key = key,
	this.Body = body;
}

function setDelteParams(bucket, file) {
	this.Bucket = bucket;
	this.Key = file.Key;
}

function setCopyParams(bucket, file) {
	this.Bucket = bucket;
	this.Key = file.Key;
	this.CopySource = bucket + '/' + file.Key;
	this.MetadataDirective = 'REPLACE'
}

function setUrlParams(bucket, key) {
	this.Bucket = bucket;
	this.Key = key;
	this.Expires = 10*365*3600*24;
}
	
function fetchUser(req, res, callback) {
	User.findOne({name: req.params.user})
	.populate('file')
	.exec(function(err, user) { 
		if (err) {
			res.json(errorHandler(err)('find user'));
		} 
		else if (!user) {
			res.json({msg: 'user doesn\'t exist'});
		}
		else {
			callback(null, user);
		}
	})
}

//function fetchUser(userName, callbak) {
//	User.findOne({name: userName}, callback(error, user) {
//		if (err) {
//			callback(error);
//		}
//		else {
//			user.populate('file');
//			callback(null, user);
//		}
//	});
//}

//function createAwsFile(params, res) {
//	s3.putObject(params, function(err, data) {
//	 if (error) {
//		 console.log(err);
//		 res.status(500);
//		 res.json({msg: 'Couldn\'t save file'});
//	 }
//	 res.json({msg: 'File is saved'});
//	})
//};

function returnAwsFilesByUser(userName, callback) {
	var params = new setListParams(bucketName, userName);
	s3.listObjects(params, function(err, data) {
		if (err) {
			callback(err);
		}
		else {
			var allFiles = data.Contents;
			callback(null, allFiles);
		}
	})
}

function copy_put_delete_AwsFile(oldParams, newParams, deleteParams, callback) {
	s3.copyObject(oldParams, function(err, data) {
		if(err) {
			console.log('couldn\'t copy old file');
			callback(err);
		} else {
			console.log('old folder successfully copied');
			s3.putObject(newParams, function(err, data) {
				if(err) {
					console.log('couldn\'t save new file');
					callback(err);
				} else {
					console.log('new folder successfully created');
					s3.deleteObject(deleteParams, function(err, data) {
						if(err) {
							console.log('couldn\'t delete the old file');
							callback(err);
						} else {
						console.log('old folder successfully deleted');
						callback(null, data);
						}
					})
				}
			})
		}
	})
}
		
											


//deleteBucket(params = {}, callback)
//deleteObject(params = {}, callback) 
 
    
           
         
   