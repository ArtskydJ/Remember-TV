const fs = require('fs')
const path = require('path')
const videoExts = require('./video-extensions-list.js')

module.exports = function readdir(absPath) {
	const name = path.basename(absPath)
	const rootNode = {
		name,
		absPath,
		parent: null,
		prettyName: 'Remember TV'
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
			parent: pnode
		}
		cnode.prettyName = prettyName(cnode.name)

		const ext = path.extname(cnode.name).slice(1)
		if (dirent.isDirectory()) {
			cnode.type = 'folder'
			pnode.folders.push(cnode)
			readsubdir(cnode)
		} else if (videoExts.has(ext)) {
			cnode.type = 'file'
			pnode.files.push(cnode)
		}
	})
	const sortByPrettyName = (a, b) => a.prettyName.localeCompare(b.prettyName, 'en', { numeric: true })
	pnode.folders.sort(sortByPrettyName)
	pnode.files.sort(sortByPrettyName)
	return pnode
}

function prettyName(name) {
	return name
		.replace(/(.+)\.[^.]+/, '$1') // remove file extension
		.replace(/[\[\(]?\b(complete|(dvd|br|hd|web)rip|bluray|xvid|hdtv|web-dl)\b.+/i, '')
		.replace(/[._]/g, ' ')
		.trim()
}

function getParents(cnode) {
	let node = { ...cnode }
	const parents = []
	while (node.parent) {
		node = node.parent
		parents.push(node)
	}
	return parents
}
