//GET /users - done
//
//POST /users - done
//
//GET /users/:user - done
//
//PUT /users/:user (rename a user and user's bucket) - done
//
//DELETE /users/:user
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

var bucketName = '55b13a28b651c557054eb832';

var s3 = new AWS.S3();

var awsRegion = 'us-east-1';

module.exports = function(router) {
	router.use(bodyParser.json());
	
	router.route('/users')
	.get(function(req, res) {
		// display all users
		User.find({}, function(err, users) {
			if (err) {
				console.log(err);
				res.status(500).json({msg: 'server error'});
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
				console.log(err);
				res.status(500).json({msg: 'server error'});
			}
			else {
				res.json({msg: 'User created'});
//	  		console.log('try to create bucket');
//				s3.createBucket({Bucket: userData._id}, function (error, data){
//					if (error) {
//						console.log(bucketName/req.body.name);
//						console.log(error);
//						res.status(500);
//						res.json({msg: 'Couldn\'t create bucket'});
//					}
//					else {
//						res.json({msg: 'User created'});
//					}
//				});
			}		
		});	
	});
	
	router.route('/users/:user/') 
	// get all information about a user
	.get(function(req, res) {
		User.findOne({name: req.params.user})
			.populate('file')
			.exec(function(err, user) { 
				if (err) {
					res.status(500).json({msg: 'server error'});
				} 
				res.json(user);
			})
		})
	.put(function(req, res) {	
	// update a user's name and update his online folder name
		var oldUserName = req.params.user,
				newUserName = req.body.name;	
		User.update({name: oldUserName}, {$set:{name: newUserName}}, function(err, user) {
			if (err) {
				res.status(500).json({msg: 'server error'});
			} 
			else if (!user) {
				res.send({msg:'couldn\'t find user'});
			}
			else {
				var params = {
									Bucket: bucketName,
									Prefix: oldUserName};
				s3.listObjects(params, function(err, data) {
					if (err) {
						console.log(err, err.stack)
					}
					else {
						var allFiles = data.Contents;
						allFiles.forEach(function(file) {
							var oldParams = {
									Bucket: bucketName,
									Key: file.Key,
									CopySource: bucketName + '/' + file.Key,
									MetadataDirective: 'REPLACE'
							};
							var newParams = {
									Bucket: bucketName,
									Key: newUserName + '/' + file.Key.split('/').pop()
							}
							s3.copyObject(oldParams, function(err, data) {
								if(err) console.log(err);
								else {
									s3.putObject(newParams, function(err, data) {
										if(err) return console.log(err);
										else {
										console.log('folder successfully copied');
										var deleteParams = {
													Bucket: bucketName,
													Key: file.Key};
										s3.deleteObject(deleteParams, function(err, data) {
											if(err) {
												console.log('couldn\'t delete the old file', err);
												}
											else {
													res.send({msg:'user name and folder successflly updated'});
												}
											})
										}
									})
								}
							})
						});
					};           
				});
			}
		});
	})
	.delete(function(req, res) {
	// delete a user and his folder and all his files
	});
	
	router.route('/users/:user/files')
	.get(function(req, res) {
		User.findOne({name: req.params.user})
			.populate('file')
			.exec(function(err, user) { 
				if (err) {
					res.status(500).json({msg: 'server error'});
				} 
				var fileOutput = {};
				user.file.forEach(function(one) {
					fileOutput[one.name] = one.url;
				})
				res.json({name: user.name, file: fileOutput});
			})
	})
	.post(function(req, res) {
		User.findOne({name: req.params.user})
		.exec(function(err, user) { 
			if (err) {
				res.status(500).json({msg: 'server error'});
			} 
			else {
				console.log(user);
				var params = {Bucket: bucketName,
											Key: user.name + '/' + req.body.fileName,
							 				Body: req.body.content};
				s3.putObject(params, function(error, data) {
				 if (error) {
					 console.log(error);
					 res.status(500);
					 res.json({msg: 'Couldn\'t upload the file'});
				 }
					console.log('Saving file to aws');
				});
				var params2 = {Bucket: bucketName,
											Key: user.name + '/' + req.body.fileName,
							 				Expires: 10*365*3600*24};
				var AWSurl = s3.getSignedUrl('getObject', params2);
				var newFile = new File({name: req.body.fileName, url: AWSurl});
				newFile.save(function(error, data) {
					if (error) {
					 console.log(error);
					 res.status(500);
					 res.json({msg: 'Couldn\'t save file reference to database'});
				 } 
					user.update({$push: {file: data._id}}, function(err) {
						if (error) {
						 console.log(error);
						 res.status(500);
						 res.json({msg: 'Couldn\'t save file reference to database'});
						}
						else {
							console.log('saving file to user');
						}
					})
				});
				res.json({msg: 'File is saved'});
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
//function fetchUser(userName, callbak) {
//	User.find({name: userName}, callback(error, user) {
//		if (err) {
//			callback(error);
//		}
//		else {
//			user.populate('file');
//			callback(null, user);
//		}
//	});
//}


									
//function createFile(userInfo) {
//	var params = {Bucket: bucketName,
//							Key: '/' + userInfo.name + '/' + req.body.fileName,
//							 Body: req.body.content};
//	s3.putObject(params, function(error, data) {
//	 if (error) {
//		 console.log(error);
//		res.status(500);
//		res.json({msg: 'Couldn\'t upload the file'});
//	 }
//	 res.json({msg: 'File is saved'});
//	})
//};


//deleteBucket(params = {}, callback)
//deleteObject(params = {}, callback) 
 
    
           
         
   