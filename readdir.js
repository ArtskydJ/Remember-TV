var fs = require('fs')
var path = require('path')
var videoExts = require('./video-extensions-list.js')

module.exports = function readdir(absPath) {
	var rootNode = {
		name: path.basename(absPath),
		absPath,
		relPath: '\\',
		parent: null
	}
	return readsubdir(rootNode)
}

function readsubdir(node) {
	node.folders = []
	node.files = []

	var filesAndFolders = fs.readdirSync(node.absPath, { withFileTypes: true })
	filesAndFolders.forEach(dirent => {
		var child = {
			name: dirent.name,
			absPath: path.join(node.absPath, dirent.name),
			relPath: path.join(node.relPath, dirent.name),
			parent: node
		}
		child.prettyPath = child.relPath.slice(1).split(path.sep).join(' — ')

		var ext = path.extname(child.name).slice(1)
		if (dirent.isDirectory()) {
			child.type = 'folder'
			child.icon = '📁'
			node.folders.push(child)
			readsubdir(child)

		} else if (videoExts.includes(ext)) {
			child.type = 'file'
			child.icon = '🎥'
			node.files.push(child)
		}
	})
	return node
}
