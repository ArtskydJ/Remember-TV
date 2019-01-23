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
		setFromFileObj,
	}

	function get(relPath) {
		console.log(relPath)
		// var fullPath = path.join(absPath, relPath)
		if (stateObj[relPath] === undefined) {
			stateObj[relPath] = false
		}
		return stateObj[relPath]
	}

	function set(relPath) { // this funciton is not used currently
		stateObj[relPath] = true
	}

	function setFromFileObj(files) {
		// do stuff
	}

	function save() {
		fs.writeFileSync(fullJsonPath, JSON.stringify(stateObj, null, '\t'))
		return stateObj
	}
}


// TODO this needs to read from a file
// Easiest would be to read the absPath or relPath
// The savefile could be like this:
// {
//     "/Andromeda/Season 1/S01E12.The.Thingy.avi": false,
//     "/Andromeda/Season 1/S01E13.The.Whatever.avi": true,
//     ...
// }
