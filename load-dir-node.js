var h = require('hyperscript')
var open = require('opn')

var eleSubheading = document.getElementById('subheading')
var eleList = document.getElementById('list')

module.exports = function loadNode(node) {
	window.scrollTo(0, 0)
	eleList.innerHTML = ''
	if (!node.parent) {
		eleSubheading.innerHTML = 'TV Shows'
	} else {
		eleSubheading.innerHTML = node.prettyPath
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
			document.body.classList.add('modal-open')
			open(item.absPath).then(function () {
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
		h('.progress', '✓')
	])
	eleList.appendChild(div)
}
