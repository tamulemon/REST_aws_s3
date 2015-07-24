var mongoose = require('mongoose'),
		Schema = mongoose.Schema;

var fileSchema = new Schema ({
	name : {type: String},
//	content : String,
	url: String
});

module.exports = mongoose.model('File', fileSchema); 

