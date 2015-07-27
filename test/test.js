var chai = require('chai');
var expect = require('chai').expect;
var mongoose = require('mongoose');
var User = require('../model/user.js');
var	File = require('../model/file.js');
var chaiHttp = require('chai-http');
var server = require('../server.js');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var bucketName = process.env.Bucket || '55b13a28b651c557054eb832';

chai.use(chaiHttp);

describe('http server', function(){
	
	before(function(done) {
		var user1 = new User({name: 'test_user1'});
		var user2 = new User({name: 'test_user2'});
		var user3 = new User({name: 'test_user3'});
		var user4 = new User({name: 'test_user4'});
		user1.save();
		user2.save();
		user3.save();
		user4.save();
		done();
	});
	
	after(function(done) {
		mongoose.connection.db.dropDatabase(function(err) {
			console.log('test database is dropped');
			done();
		});
	})
	
	it ('1. add a new user', function(done) {
		chai.request('localhost:8080/api')
		.post('/users')
		.send({ name: 'Meng'})
		.end(function (err, res) {
     	expect(err).to.be.null;
     	expect(res).to.have.status(200);
			expect(JSON.parse(res.text)).deep.equal({msg: 'user is created'});
			done();
		});
	});
	
	it ('2. won\'t add duplicated user name', function(done) {
		chai.request('localhost:8080/api')
		.post('/users')
		.send({ name: 'test_user1'})
		.end(function (err, res) {
			expect(JSON.parse(res.text).status).equal(500);
			expect(JSON.parse(res.text).msg).equal('server error, couldn\'t create user. user already exist');
			done();
		});
	});
		
		
	it ('3. retrieve information about a user', function(done) {
		chai.request('localhost:8080/api')
		.get('/users/test_user1')
		.end(function (err, res) {
		  expect(res).to.have.status(200);
			expect(JSON.parse(res.text).name).equal('test_user1');
			done();
		});
	});	
		
	it ('4. rename a user without files', function(done) {
		chai.request('localhost:8080/api')
		.put('/users/test_user1')
		.send({name: 'test_user1_changed'})
		.end(function (err, res) {
		  expect(res).to.have.status(200);
			expect(JSON.parse(res.text).msg).equal('user name updated');
			done();
		});
	});		
		
	it ('5. delete a user without files', function(done) {
		chai.request('localhost:8080/api')
		.delete('/users/test_user2')
		.end(function (err, res) {
		  expect(res).to.have.status(200);
			expect(JSON.parse(res.text).msg).equal('user deleted');
			done();
		});
	});		
		
		
	it ('6. won\'t rename user if user does not exist', function(done) {
		chai.request('localhost:8080/api')
		.put('/users/XYZ')
		.send({name: 'test_user1_changed'})
		.end(function (err, res) {
		  expect(res).to.have.status(200);
			expect(JSON.parse(res.text).msg).equal('user doesn\'t exist');
			done();
		});
	});		
	
	
	it ('7. won\'t delete a user if user name does not exist', function(done) {
		chai.request('localhost:8080/api')
		.delete('/users/XYZ')
		.end(function (err, res) {
		  expect(res).to.have.status(200);
			expect(JSON.parse(res.text).msg).equal('user doesn\'t exist');
			done();
		});
	});	
	
	
	it ('8. stores and retrieve a file in user folder', function(done) {
		chai.request('localhost:8080/api')
		.post('/users/test_user3/files')
		.send({fileName:"file5", content: "test5"})
		.end(function (err, res) {
		  expect(res).to.have.status(200);
			expect(JSON.parse(res.text).msg).equal('file is saved');
			setTimeout(function() {
				s3.getObject({Bucket: bucketName, Key: 'test_user3/file5'}, function(err, data) {
					expect(err).null;
					expect(data.body).is.not.null;
					console.log('ok');
					done();
				})
			}, 500)
		})
	})
	
	it ('8.1. stores another file to the user', function(done) {
		chai.request('localhost:8080/api')
		.post('/users/test_user3/files')
		.send({fileName:"file6", content: "test6"})
		.end(function (err, res) {
		  expect(res).to.have.status(200);
			expect(JSON.parse(res.text).msg).equal('file is saved');
			done();
		});
	});	
	
	it ('9. update a file in user folder', function(done) {
		chai.request('localhost:8080/api')
		.put('/users/test_user3/files/file5')
		.send({content: 'update update'})
		.end(function (err, res) {
			expect(res).to.have.status(200);
			expect(JSON.parse(res.text).msg).equal('file updated');
			done();
		});
	})	
	
	it ('10. retrieve all user files', function(done) {
		chai.request('localhost:8080/api')
		.get('/users/test_user3/files')
		.end(function (err, res) {
			expect(res).to.have.status(200);
			expect(JSON.parse(res.text)).to.have.property('file').that.is.an('object');
			done();
		});
	})	
	
	it ('11. update user name with files', function(done) {
		chai.request('localhost:8080/api')
		.put('/users/test_user3')
		.send({name: 'test_user3_changed'})
		.end(function (err, res) {
			expect(res).to.have.status(200);
			expect(JSON.parse(res.text).msg).equal('user name and file update completed');
			setTimeout(function() {
				s3.listObjects({Bucket: bucketName, Prefix: 'test_user3_changed'}, function(err, data) {
					expect(err).null;
					expect(data.Contents).not.null;
				})
			}, 500)
			done();
		})
	})
	
	it ('12. delete a user name and all files', function(done) {
		chai.request('localhost:8080/api')
		.delete('/users/test_user3_changed')
		.end(function (err, res) {
			expect(res).to.have.status(200);
			expect(JSON.parse(res.text).msg).equal('user and all files deleted');
			done();
		});
	})

});