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
			type: 'folder'
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

function addItem(eleList, item, onclick) {
	var div = h('.list-item', { onclick }, [
		h(`.title.${item.type}.${item.videoStr}`, [
			h('span.icon', item.icon),
			item.name
		]),
		h('.progress', [
			(item.watched === true ? '✓' :
				(item.watched === false ? '✗' : '')),
			// ' ≡'
		])
	])
	eleList.appendChild(div)
}
