var chai = require('chai');
var expect = require('chai').expect;
var chaiHttp = require('chai-http');
var countJSONFile = require('../controller_wo_interface.js').countJSONFile;
var fileCount;
var jsonFile;

chai.use(chaiHttp);

describe('http server', function(){
	
	it ('get all files for view', function(done) {
		chai.request('localhost:8080')
		.get('/api/post')
//		.then(function (res) {
//     	expect(res).to.have.status(200);
//			expect(res).to.have.header('content-type','text/html; charset=utf');
//			expect(res.body).equal('you have '+ fileCount  +' JSON files in your data folder' + jsonFile);
//  	})
//  	.catch(function (err) {
//     	throw err;
//  	})
		.end(function(err, res) {
			expect(err).to.be.null;
			expect(res).to.have.header('content-type','text/html; charset=utf-8');
			expect(res).to.have.status(200);
			expect(res.text).to.match(/^you have [0-9]* JSON files in your data folder/);
			done();
		});
	});
	
	it ('post will save a file', function(done) {
		chai.request('localhost:8080')
		.post('/api/post')
		.send({ username: 'me', password: '123'})
		.end(function (err, res) {
     	expect(err).to.be.null;
     	expect(res).to.have.status(200);
			done();
		});
	});
	
	it ('put will update a file', function(done) {
		chai.request('localhost:8080')
		.put('/api/post/file_9.json') //if this file doesn't exist, will create the file
		.send({ username: 'me', password: '123'})
		.end(function (err, res) {
			expect(err).to.be.null;
			expect(res).to.have.status(200);
			done();
		});
	});
	
	it ('delete will remove a file', function(done) {
		chai.request('localhost:8080')
		.delete('/api/post/file_9.json')
		.end(function (err, res) {
			expect(err).to.be.null;
			expect(res).to.have.status(200);
			done();
		});
	});
	
});