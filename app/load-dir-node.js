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
		addListItem({
			cnode: { icon: '↩', name: 'Go Back', type: 'back' },
			onleftclick: function () { loadNode(state, pnode.parent) }
		})
	}
	pnode.folders.forEach(function addFolder(cnode) {
		addListItem({ cnode, state,
			onleftclick: function (eleListItem) { loadNode(state, cnode) },
			onrightclick: function (eleListItem) {
				var total = getTotalChildren(cnode)
				var watched = getWatchedChildren(state, cnode)
				var watchedAll = total === watched
				var message = `Mark all video files as ${watchedAll ? 'un' : ''}watched?`
				if (confirm(message)) {
					setChildrenWatched(state, cnode, !watchedAll)
					state.save()

					eleListItem.lastChild.innerHTML = `${watchedAll ? '0' : total}/${total}`
				}
			}
		})
	})
	pnode.files.forEach(function addFile(cnode) {
		function setWatched(eleListItem, newIsWatched) {
			eleListItem.lastChild.classList[newIsWatched ? 'add' : 'remove']('watched')

			state.set(cnode, newIsWatched)
			state.save()
		}

		addListItem({ cnode, state,
			onleftclick: function (eleListItem) {
				setWatched(eleListItem, true)

				document.body.classList.add('modal-open')
				open(cnode.absPath).then(function () {
					document.body.classList.remove('modal-open')
				})
			},
			onrightclick: function (eleListItem) {
				setWatched(eleListItem, !state.get(cnode))
			}
		})
	})
}

function addListItem({ cnode, state, onleftclick, onrightclick }) {
	function eventWrapper(eventHandler) {
		return function evhw(ev) {
			ev.preventDefault()
			ev.stopPropagation()
			eventHandler(div)
			return false
		}
	}

	var div = h(`.list-item.${cnode.type}`, {
		onclick: eventWrapper(onleftclick),
		oncontextmenu: eventWrapper(onrightclick || (a=>{}))
	}, [
		h('span.icon', cnode.icon),
		h('.name', [ cnode.name ]),
		// h('button', { onclick:()=>{ console.log('markWatched') } }, [ 'Mark Watched' ]),
		{
			folder: ()=> h('.progress', [ getWatchedChildren(state, cnode) + '/' + getTotalChildren(cnode) ]),
			file: ()=>h(`.progress.icon${ state.get(cnode) ? '.watched' : '' }`),
			back: ()=>'',
		}[cnode.type]()
	])
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
		return Number(state.get(file))
	}).reduce(sum, 0)
	return folderWatchCount + fileWatchCount
}
function sum(memo, curr) {
	return memo + curr
}
function setChildrenWatched(state, node, newIsWatched) {
	node.folders.forEach(function (cnode) {
		setChildrenWatched(state, cnode, newIsWatched)
	})
	node.files.forEach(function (cnode) {
		state.set(cnode, newIsWatched)
	})
}
