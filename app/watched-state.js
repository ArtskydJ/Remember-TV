var fs = require('fs')
var path = require('path')

module.exports = function watchedState(absPath) {
	var fullJsonPath = path.join(absPath, '.remembertv.json')
	var stateObj = null
	try {
		stateObj = JSON.parse(fs.readFileSync(fullJsonPath, 'utf-8'))
	} catch(_) {
		console.log(_.message)
		stateObj = {}
	}

	return {
		get,
		set,
		save,
		//setFromFileObj,
	}

	function get(relPath) {
		// console.log(relPath)
		// var fullPath = path.join(absPath, relPath)
		if (stateObj[relPath] === undefined) {
			stateObj[relPath] = false
		}
		return stateObj[relPath]
	}

	function set(relPath) {
		stateObj[relPath] = true
	}

/*
	function setFromFileObj(item) {
		var state = {}
		recurse(item)

		function recurse(item) {
			item.folders.forEach(recurse)
			item.files.forEach(function (file) {
				state[file.relPath] = file.watched
			})
		}
	}
*/

	function save() {
		fs.writeFileSync(fullJsonPath, JSON.stringify(stateObj, null, '\t'))
		return stateObj
	}
}
