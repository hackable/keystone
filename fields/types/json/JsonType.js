var assign = require('object-assign');
var FieldType = require('../Type');
var TextType = require('../text/TextType');
var util = require('util');
var utils = require('keystone-utils');


/**
 * HTML FieldType Constructor
 * @extends Field
 * @api public
 */
function json (list, path, options) {
	this._nativeType = Object;
	this._defaultSize = 'full';
	this.height = options.height || 180;
	this._properties = ['editor', 'height'];
	this.codemirror = options.codemirror || {};
	this.editor = assign({ mode: json }, this.codemirror);
	json.super_.call(this, list, path, options);
}

json.properName = 'Json';
util.inherits(json, FieldType);

/* Inherit from TextType prototype */
json.prototype.addFilterToQuery = TextType.prototype.addFilterToQuery;


json.prototype.validateInput = function (data, callback) {
	var input = this.getValueFromData(data);
	var result = true;

	if (input === undefined || input === null ) {
		result = true;
	} else {
		 if (typeof input !== 'object') { result = false }
	}
	utils.defer(callback, result);
};


/* Export Field Type */
module.exports = json;
