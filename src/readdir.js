const fs = require('fs')
const path = require('path')
import videoExts from './video-extensions-list.js'

export default function readdir(absPath) {
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
		cnode.prettyName = prettyName(cnode)

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

function prettyName(cnode) {
	// const parentFileNameRegex = new RegExp(`^((${getParents(cnode).map(pnode => pnode.name).join('|')}) ?)+`)
	const fileExtRegex = new RegExp(`\\.(${[ ...videoExts ].join('|')})$`)
	return cnode.name
		// .replace(parentFileNameRegex, '') // remove parent folder names
		.replace(fileExtRegex, '') // remove file extension
		.replace(/[._]/g, ' ')
		// .replace(/\b(complete|(dvd|br|hd|web)rip|bluray|xvid|hdtv|web-dl)\b.+/i, '')
		.trim()
}

// function getParents(cnode) {
// 	let node = { ...cnode }
// 	const parents = []
// 	while (node.parent) {
// 		node = node.parent
// 		parents.push(node)
// 	}
// 	return parents
// }
