var mongoose = require('mongoose'),
		Schema = mongoose.Schema;

var userSchema = new Schema ({
	name : {type: String, unique: true},
//	bucketName : String,
	file : [{type: Schema.Types.ObjectId, ref: 'File'}]
});

module.exports = mongoose.model('User', userSchema); 

