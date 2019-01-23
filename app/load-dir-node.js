var h = require('hyperscript')
var open = require('opn')

var eleTitle = document.getElementById('title')
var eleList = document.getElementById('list')

module.exports = function loadNode(node) {
	window.scrollTo(0, 0)
	eleList.innerHTML = ''
	if (!node.parent) {
		eleTitle.innerHTML = 'TV Shows'
	} else {
		eleTitle.innerHTML = node.prettyPath
		var item = {
			icon: '↩',
			name: 'Go Back',
			type: 'back'
		}
		var onclickBack = function () {
			loadNode(node.parent)
		}
		addItem(eleList, item, onclickBack)
	}
	node.folders.forEach(function addFolder(item) {
		var onclickFolder = function () {
			loadNode(item)
		}
		addItem(eleList, item, onclickFolder)
	})
	node.files.forEach(function addFile(item) {
		var onclickFile = function () {
			item.watched = true // I don't think this will change the icon
			document.body.classList.add('modal-open')
			open(item.absPath).then(function () {
				// If, instead of a modal, I clear out the whole page, then when I
				// re-create the page, then I can make it with the correct checks/ex's
				document.body.classList.remove('modal-open')
			})
		}
		addItem(eleList, item, onclickFile)
	})
}

function addItem(eleList, item, onclick, onrightclick = () => {}) {
	oncontextmenu = ev => {
		ev.preventDefault()
		onrightclick()
		return false
	}
	var div = h('.list-item', { onclick, oncontextmenu }, [
		h(`.title.${item.type}`, [
			h('span.icon', item.icon),
			item.name
		]),
		// h('button', { onclick:function(){console.log('markWatched');return false} }, [ 'Mark Watched' ]),
		{
			folder: ()=> h('.progress', [ getWatchedChildren(item) + '/' + getTotalChildren(item) ]),
			file: ()=>h(`.progress.icon.${ item.watched ? '' : 'not-' }watched`),
			back: ()=>'',
		}[item.type]()
	])
	// item.div = div
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
	console.dir(item)
	var folderWatchCount = item.folders.map(function (folder) {
		return getWatchedChildren(folder)
	}).reduce(sum, 0)
	var fileWatchCount = item.files.map(function (file) {
		return file.watched ? 1 : 0
	}).reduce(sum, 0)
	return folderWatchCount + fileWatchCount
}
function sum(memo, curr) {
	return memo + curr
}
