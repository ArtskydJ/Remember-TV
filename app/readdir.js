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

function readsubdir(state, pnode) {
	pnode.folders = []
	pnode.files = []

	var filesAndFolders = fs.readdirSync(pnode.absPath, { withFileTypes: true })
	filesAndFolders.forEach(dirent => {
		var cnode = {
			name: dirent.name,
			absPath: path.join(pnode.absPath, dirent.name),
			relPath: path.join(pnode.relPath, dirent.name),
			parent: pnode
		}
		cnode.prettyPath = cnode.relPath.slice(1).split(path.sep).join(' — ')

		var ext = path.extname(cnode.name).slice(1)
		if (dirent.isDirectory()) {
			cnode.type = 'folder'
			cnode.icon = '📁'
			pnode.folders.push(cnode)
			readsubdir(state, cnode)

		} else if (videoExts.includes(ext)) {
			cnode.type = 'file'
			cnode.icon = '🎥'
			cnode.watched = {
				get: ()=>state.get(cnode.relPath),
				set: v=>state.set(cnode.relPath, v),
			}
			pnode.files.push(cnode)
		}
	})
	return pnode
}
