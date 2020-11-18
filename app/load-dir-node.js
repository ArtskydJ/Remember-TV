const path = require('path')
const h = require('hyperscript')
const open = require('opn')

const eleTitle = document.getElementById('title')
const eleList = document.getElementById('list')

module.exports = function loadNode(state, pnode) {
	window.scrollTo(0, 0)
	eleList.innerHTML = ''
	if (!pnode.parent) {
		eleTitle.innerHTML = 'Remember TV'
	} else {
		eleTitle.innerHTML = prettyPath(pnode.relPath)
		addListItem({
			cnode: { icon: '↩', name: 'Go Back', type: 'back' },
			onleftclick: () => loadNode(state, pnode.parent),
		})
	}
	pnode.folders.forEach(function addFolder(cnode) {
		addListItem({
			cnode,
			state,
			onleftclick: eleListItem => loadNode(state, cnode),
			onrightclick: eleListItem => {
				const total = getTotalChildren(cnode)
				const watched = getWatchedChildren(state, cnode)
				const watchedAll = total === watched
				const message = `Mark all video files as ${watchedAll ? 'un' : ''}watched?`
				if (confirm(message)) {
					setChildrenWatched(state, cnode, !watchedAll)
					state.save()

					eleListItem.lastChild.innerHTML = `${watchedAll ? '0' : total}/${total}`
					eleListItem.lastChild.classList.remove('all')
					eleListItem.lastChild.classList.remove('partial')
					eleListItem.lastChild.classList.remove('none')
					eleListItem.lastChild.classList.add(watchedAll ? 'none' : 'all')
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

		addListItem({
			cnode,
			state,
			onleftclick: eleListItem => {
				setWatched(eleListItem, true)

				document.body.classList.add('modal-open')
				open(cnode.absPath).then(() => document.body.classList.remove('modal-open'))
			},
			onrightclick: eleListItem => setWatched(eleListItem, !state.get(cnode))
		})
	})
}

function addListItem({ cnode, state, onleftclick, onrightclick }) {
	function eventWrapper(eventHandler) {
		return ev => {
			ev.preventDefault()
			ev.stopPropagation()
			eventHandler && eventHandler(div)
			return false
		}
	}

	const nameOptions = cnode.type === 'file' ? { title: cnode.name } : {}

	let progressIndicator = ''
	if (cnode.type === 'folder') {
		const watched = getWatchedChildren(state, cnode)
		const total = getTotalChildren(cnode)
		if (total === 0) return
		const className = watched === total ? 'all' : (watched === 0 ? 'none' : 'partial')

		progressIndicator = h(`.progress.${className}`, [ `${ watched }/${ total }` ])
	} else if (cnode.type === 'file') {
		progressIndicator = h(`.progress.icon${ state.get(cnode) ? '.watched' : '' }`)
	}

	const div = h(`.list-item.${cnode.type}`, {
		onclick: eventWrapper(onleftclick),
		oncontextmenu: eventWrapper(onrightclick)
	}, [
		h('span.icon', cnode.icon),
		h('.name', nameOptions, [ prettyName(cnode.name) ]),
		progressIndicator
	])
	eleList.appendChild(div)
}

const getTotalChildren = node =>
	sum(node.folders.map(getTotalChildren))
	+ node.files.length

const getWatchedChildren = (state, node) =>
	sum(node.folders.map(folder => getWatchedChildren(state, folder)))
	+ sum(node.files.map(file => Number(state.get(file))))

const sum = arr => arr.reduce((a, b) => a + b, 0)


function setChildrenWatched(state, node, newIsWatched) {
	node.folders.forEach(cnode => setChildrenWatched(state, cnode, newIsWatched))
	node.files.forEach(cnode => state.set(cnode, newIsWatched))
}
function prettyPath(relPath) {
	return relPath
		.slice(1)
		.split(path.sep)
		.map(prettyName)
		.join(' — ')
}
function prettyName(name) {
	return name
		.replace(/(.+)\.[^.]+/, '$1')
		.replace(/[\[\(]?\b(complete|(dvd|br|hd|web)rip|bluray|xvid|hdtv|(480|720|1080)p?|sd|web-dl)\b.+/i, '')
		// if there are no spaces, then replace dots, underscores with spaces
		.replace(/^[^ ]+$/, s => s.replace(/[._]/g, ' '))
		.trim()
}
