const fs = require('fs')
const path = require('path')
const videoExts = require('./video-extensions-list.js')

module.exports = function readdir(absPath) {
	const rootNode = {
		name: path.basename(absPath),
		absPath,
		relPath: '\\',
		parent: null
	}
	return readsubdir(rootNode)
}

function readsubdir(pnode) {
	pnode.folders = []
	pnode.files = []

	fs.readdirSync(pnode.absPath, { withFileTypes: true }).forEach(dirent => {
		const cnode = {
			name: dirent.name,
			absPath: path.join(pnode.absPath, dirent.name),
			relPath: path.join(pnode.relPath, dirent.name),
			parent: pnode
		}

		const ext = path.extname(cnode.name).slice(1)
		if (dirent.isDirectory()) {
			cnode.type = 'folder'
			cnode.icon = '📁'
			pnode.folders.push(cnode)
			readsubdir(cnode)
		} else if (videoExts.includes(ext)) {
			cnode.type = 'file'
			cnode.icon = '🎥'
			pnode.files.push(cnode)
		}
	})
	return pnode
}
