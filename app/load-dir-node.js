var h = require('hyperscript')
var open = require('opn')

var eleTitle = document.getElementById('title')
var eleList = document.getElementById('list')

module.exports = function loadNode(state, pnode) {
	window.scrollTo(0, 0)
	eleList.innerHTML = ''
	if (!pnode.parent) {
		eleTitle.innerHTML = 'TV Shows'
	} else {
		eleTitle.innerHTML = pnode.prettyPath
		var item = {
			icon: '↩',
			name: 'Go Back',
			type: 'back'
		}
		var onclickBack = function () {
			loadNode(state, pnode.parent)
		}
		addItem(eleList, item, null, onclickBack)
	}
	pnode.folders.forEach(function addFolder(item) {
		var onclickFolder = function () {
			loadNode(state, item)
		}
		addItem(eleList, item, state, onclickFolder)
	})
	pnode.files.forEach(function addFile(cnode) {
		function setWatched(ev, newIsWatched) {
			// I don't like this element targeting code:
			ev.target.parentNode.lastChild.classList.remove(newIsWatched ? 'not-watched' : 'watched')
			ev.target.parentNode.lastChild.classList.add(newIsWatched ? 'watched' : 'not-watched')

			state.set(cnode.relPath, newIsWatched)
		}
		var onclickFile = function (ev) {
			setWatched(ev, true)

			document.body.classList.add('modal-open')
			open(cnode.absPath).then(function () {
				document.body.classList.remove('modal-open')
			})
		}
		var onrightclickFile = function (ev) {
			setWatched(ev, !state.get(cnode.relPath))
		}
		addItem(eleList, cnode, state, onclickFile, onrightclickFile)
	})
}

function addItem(eleList, node, state, onclick, onrightclick = () => {}) {
	oncontextmenu = ev => {
		ev.preventDefault()
		ev.stopPropagation()
		onrightclick(ev)
		return false
	}
	var div = h('.list-item', { onclick, oncontextmenu }, [
		h('span.icon', node.icon),
		h(`.name.${node.type}`, [
			node.name
		]),
		// h('button', { onclick:function(){console.log('markWatched');return false} }, [ 'Mark Watched' ]),
		{
			folder: ()=> h('.progress', [ getWatchedChildren(state, node) + '/' + getTotalChildren(node) ]),
			file: ()=>h(`.progress.icon.${ state.get(node.relPath) ? '' : 'not-' }watched`),
			back: ()=>'',
		}[node.type]()
	])
	node.ele = div
	eleList.appendChild(div)
}

function getTotalChildren(node) {
	var folderWatchCount = node.folders.map(function (folder) {
		return getTotalChildren(folder)
	}).reduce(sum, 0)
	var fileWatchCount = node.files.length
	return folderWatchCount + fileWatchCount
}
function getWatchedChildren(state, node) {
	var folderWatchCount = node.folders.map(function (folder) {
		return getWatchedChildren(state, folder)
	}).reduce(sum, 0)
	var fileWatchCount = node.files.map(function (file) {
		return Number(state.get(file.relPath))
	}).reduce(sum, 0)
	return folderWatchCount + fileWatchCount
}
function sum(memo, curr) {
	return memo + curr
}
