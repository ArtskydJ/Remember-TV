var fs = require('fs')
var path = require('path')
var videoExts = require('./video-extensions-list.js')

var files = readsubdir('E:\\Video\\TV', {})
var json = JSON.stringify(files, null, '\t')

fs.writeFileSync('E:\\Video\\TV\\rememtv.json', json)
console.log('WROTE FILE')

function readsubdir(absPath, node) {
	console.log('ABS:', absPath)
	var filesAndFolders = fs.readdirSync(absPath, { withFileTypes: true })
	filesAndFolders.forEach(dirent => {
		var ext = path.extname(dirent.name).slice(1)
		if (dirent.isDirectory()) {
			node[dirent.name] = {}
			var newpath = path.join(absPath, dirent.name)
			readsubdir(newpath, node[dirent.name])

		} else if (videoExts.includes(ext)) {
			node[dirent.name] = false
		}
	})
	return node
}
