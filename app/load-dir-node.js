var h = require('hyperscript')
var open = require('opn')

var eleTitle = document.getElementById('title')
var eleList = document.getElementById('list')

module.exports = function loadNode(pnode) {
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
			loadNode(pnode.parent)
		}
		addItem(eleList, item, onclickBack)
	}
	pnode.folders.forEach(function addFolder(item) {
		var onclickFolder = function () {
			loadNode(item)
		}
		addItem(eleList, item, onclickFolder)
	})
	pnode.files.forEach(function addFile(cnode) {
		var onclickFile = function (ev) {
			// I don't like this code:
			ev.target.parentNode.lastChild.classList.remove('not-watched')
			ev.target.parentNode.lastChild.classList.add('watched')

			cnode.watched.set(true) // I don't think this will change the icon
			document.body.classList.add('modal-open')
			open(cnode.absPath).then(function () {
				document.body.classList.remove('modal-open')
			})
		}
		addItem(eleList, cnode, onclickFile)
	})
}

function addItem(eleList, item, onclick, onrightclick = () => {}) {
	oncontextmenu = ev => {
		ev.preventDefault()
		onrightclick(ev)
		return false
	}
	var div = h('.list-item', { onclick, oncontextmenu }, [
			h('span.icon', item.icon),
		h(`.title.${item.type}`, [
			item.name
		]),
		// h('button', { onclick:function(){console.log('markWatched');return false} }, [ 'Mark Watched' ]),
		{
			folder: ()=> h('.progress', [ getWatchedChildren(item) + '/' + getTotalChildren(item) ]),
			file: ()=>h(`.progress.icon.${ item.watched.get() ? '' : 'not-' }watched`),
			back: ()=>'',
		}[item.type]()
	])
	item.ele = div
	eleList.appendChild(div)
}

function getTotalChildren(item) {
	var folderWatchCount = item.folders.map(function (folder) {
		return getTotalChildren(folder)
	}).reduce(sum, 0)
	var fileWatchCount = item.files.length
	return folderWatchCount + fileWatchCount
}
function getWatchedChildren(item) {
	var folderWatchCount = item.folders.map(function (folder) {
		return getWatchedChildren(folder)
	}).reduce(sum, 0)
	var fileWatchCount = item.files.map(function (file) {
		return file.watched.get() ? 1 : 0
	}).reduce(sum, 0)
	return folderWatchCount + fileWatchCount
}
function sum(memo, curr) {
	return memo + curr
}
