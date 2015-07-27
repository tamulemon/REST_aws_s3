//GET /users - done- pass
//
//POST /users - done - pass
//
//GET /users/:user - done - pass
//
//PUT /users/:user (rename a user and user's folder) - done - pass for user without files
//
//DELETE /users/:user - done - done - pass for user without files
//
//GET /user/:user/files - done
//
//POST /user/:user/files - done
//
//GET /user/:user/files/:file - pass
//
//PUT /user/:user/files/:file (replace an already existing file, or update it somehow. - done - pass
//
//DELETE /user/:user/files (deletes all files. - done

// {"fileName": "fileOne": "content": "hello world!"}

// binary data

var express = require('express');
var bodyParser = require('body-parser');
var User = require('../model/user.js');
var File = require('../model/file.js');
var AWS = require('aws-sdk');

// because the requirement is updated to all users are going to share the same bucket, it is hardcoded here or can be passed through environment variable
var bucketName = process.env.Bucket || '55b13a28b651c557054eb832';

var s3 = new AWS.S3();

var awsRegion = 'us-east-1';

module.exports = function(router) {
	router.use(bodyParser.json());

	router.route('/users')
	.get(function(req, res) {
		// GET /users. display all users
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
		// POST /users
		//create a new user. a folder for this user is not created at this point. a bucket is also not created because users are sharing the same bucket
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
	// GET /users/:user
	//get all information about a user
	.get(function(req, res) {
		fetchUser(req, res, function(err, user) {
			res.json(user);
		});
	})
	.put(function(req, res) {	
	// PUT /users/:user
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
					if (total !== 0) {
						data.forEach(function(file) {
							var oldParams = new setCopyParams(bucketName, file);
							var fileName = file.Key.split('/').pop();
							var newParams = new setParams(bucketName, newUserName + '/' + fileName);
							var deleteParams = new setDeleteParams(bucketName, file);
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
					} else {
						user.update({name: newUserName}, function(err) {
							if (err) return res.json(errorHandler(err)('update user name'));
							res.json({msg:'user name updated'});
						})
					}
				}
			})
		})
	})
	.delete(function(req, res) {
	// DELETE /users/:user
	// delete a user and his folder and all his files
		fetchUser(req, res, function(err, user) {
			var fileIds = [];
			user.file.forEach(function(file) {
				fileIds.push(file._id);
			})
			if (fileIds.length > 0) {
				File.remove({ _id: { $in: fileIds } }, function (err) {
					if (err) {
						res.json(errorHandler(err)('delete files of user'));
					}	else {
						deleteAllUserFiles(user.name, function(err, data) {
							if (err) {
								console.log(err);
								res.json(errorHandler(err)('delete user\'s files'));
							} else {
								user.remove();
								res.json({msg: 'user and all files deleted'});
							}
						});
					}
				})
			} else {
					user.remove();
					res.json({msg: 'user deleted'});
			}
		})
	})

	
	router.route('/users/:user/files')
	//GET /user/:user/files 
	// display all files and their urls for a user
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
		//POST /user/:user/files
		// post a file, pass through req.body
		fetchUser(req, res, function(err, user) {
			for (var i = 0; i < user.file.length; i ++) {
				// unique file name per user
				if (user.file[i].name === req.body.fileName) { 
					res.json({msg: 'file name already exists for this user'});
					return;
				}
			}
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
		//DELETE /user/:user/files 
		// delete all files under a user, but the user will be kept
		fetchUser(req, res, function(err, user) {
			var fileIds = [];
			user.file.forEach(function(file) {
				fileIds.push(file._id);
			})
//			console.log(user);
//			console.log(fileIds);
			user.file = [];
			user.save();
			File.remove({ _id: { $in: fileIds } }, function (err) {
				if (err) {
					res.json(errorHandler(err)('delete files of user'));
				}	else {
					deleteAllUserFiles(user.name, function(err, data) {
						if (err) {
							console.log(err);
							res.json(errorHandler(err)('delete user\'s files'));
						} else {
							res.json({msg: 'all files deleted'});
						}
					});
				}
			})
		})
	})


	router.route('/users/:user/files/:file')
	//GET /user/:user/files/:file
	// view a specific file and its url
	.get(function(req, res) {
		fetchUser(req, res, function(err, user) {
			user.file.forEach(function(file) {
				if (file.name === req.params.file) {
					res.json({name: file.name, url: file.url});
				}
			})	
		});
	})
	.put(function(req, res) {
		// PUT /user/:user/files/:file
		// update the content of a file.  
		fetchUser(req, res, function(err, user) {
			var fileExist;
			user.file.forEach(function(file) {
				if (file.name === req.params.file) {
					fileExist = true;
					var newParams = new setPutParams(bucketName, user.name + '/' + req.params.file, req.body.content);
					var urlParams = new setUrlParams(bucketName, user.name + '/' + req.params.file);
					var deleteParams = {Bucket: bucketName, Key: user.name + '/' + req.params.file};
					update_AwsFile_returnUrl(newParams, deleteParams, urlParams, function(err, newUrl) {
						if (err) {
							res.json(errorHandler(err)('update user\'s file'));
							
						} else {
							// this is not needed actually. If the bucket and key stays the same, AWS s3 will reuse the signedURL so the url should stay the same!
							File.update({_id: user.file._d}, {$set: {url: newUrl}}, function(err) {
								if(err) {
									res.json(errorHandler(err)('update file url'));
								}
								else {
									res.json({msg: 'file updated'});
								}
							});
						}
					})
				}
			})
			if(!fileExist) {
					res.json({msg: 'the file doesn\'t exist'});
				}
		})
	})
	.delete(function(req, res) {
		// DELETE /user/:user/files/:file
		// delete a specific file
		fetchUser(req, res, function(err, user) {
			var fileExist;
			for (var i = 0; i < user.file.length; i++) {
				console.log(i);
				var file = user.file[i];
				if (file.name === req.params.file) {
					fileExist = true;
					var deleteParams = {Bucket: bucketName, Key: user.name + '/' + req.params.file};
					s3.deleteObject(deleteParams, function(err, data) {
						if (err) {
							res.json(errorHandler(err)('delete user\'s file'));
						} else {
							File.remove({_id: file._id}, function(err) {
								if(err) {
									res.json(errorHandler(err)('delete file from database'));
								}
								else {
									user.file.splice(i, 1);
									user.save();
									res.json({msg: 'file deleted'});
								}
							});
						}
					})
					break; 
				}
			}
			if(!fileExist) {
					res.json({msg: 'the file doesn\'t exist'});
				}
		})
	})


};

///////////////////////////////////////////////////////////////////////////////////////////////////////
//
// helper functions
					

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

function setDeleteParams(bucket, file) {
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

// this is not needed actually. If the bucket and key stays the same, AWS s3 will reuse the signedURL so the url should stay the same!
// I am just keeping this to be extra save, in case AWS change their workflow in the future
function update_AwsFile_returnUrl(newParams, deleteParams, urlParams, callback) {
	s3.deleteObject(deleteParams, function(err, data) {
		if(err) {
			console.log('couldn\'t delete the old file');
			callback(err);
		} else {
			s3.putObject(newParams, function(err, data) {
				if(err) {
					console.log('couldn\'t create new file');
					callback(err);
				} else {
					var AWSurl = s3.getSignedUrl('getObject', urlParams);
					callback(null, AWSurl);
				}
			})
		}
	})
}
										
function deleteAllUserFiles(userName, callback) {
	returnAwsFilesByUser(userName, function(err, data) {
		if (err) callback(err);
		else {
			var deleteKeyList = [];
			data.forEach(function(file) {
			 deleteKeyList.push({Key: file.Key});
			});
			var params = {
				Bucket: bucketName, 
				Delete: {Objects: deleteKeyList}
			};
			s3.deleteObjects(params, function(err, data) {
				if(err) callback(err);
				else callback(null, data);
			})
		}
	})
}


 
    
           
         
   