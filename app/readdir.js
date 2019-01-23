var fs = require('fs')
var path = require('path')
var videoExts = require('./video-extensions-list.js')
var watchedState = require('./watched-state.js')

// it should load whether a thing is "watched" as it loads the file...

module.exports = function readdir(absPath) {
	var state = watchedState(absPath)
	var rootNode = {
		name: path.basename(absPath),
		absPath,
		relPath: '\\',
		parent: null
	}
	return readsubdir(state, rootNode)
}

function readsubdir(state, node) {
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
			readsubdir(state, child)

		} else if (videoExts.includes(ext)) {
			child.type = 'file'
			child.icon = '🎥'
			child.watched = state.get(child.relPath)
			node.files.push(child)
		}
	})
	return node
}
