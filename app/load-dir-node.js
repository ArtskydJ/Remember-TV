const { shell } = require('electron')
const h = require('hyperscript')
const watchedState = require('./watched-state.js')

const eleList = document.getElementById('list')

module.exports = function loadNode(store, pnode) {
	store.set('cwd', pnode.absPath)
	const state = watchedState(store)

	window.scrollTo(0, 0)
	eleList.innerHTML = ''
	document.title = prettyPath(pnode)
	state.save()

	if (pnode.parent) {
		addListItem({
			cnode: { name: 'Go Back', type: 'back' },
			onleftclick: () => loadNode(store, pnode.parent),
		})
	}
	pnode.folders.forEach(function addFolder(cnode) {
		addListItem({
			cnode,
			state,
			onleftclick: eleListItem => loadNode(store, cnode),
			onrightclick: eleListItem => {
				const { total, watched } = getChildren(cnode, state)
				const watchedAll = total === watched
				const message = `Mark all video files as ${watchedAll ? 'un' : ''}watched?`
				if (confirm(message)) {
					setChildrenWatched(state, cnode, !watchedAll)
					state.save()

					const watched = watchedAll ? 0 : total
					const partial = 0
					const unwatched = watchedAll ? total : 0


					const progressIndicator = h('.progress', {
						title: `Unwatched: ${unwatched} | Partial: ${partial} | Watched: ${watched}`
					}, [
						h(`span.${watchedAll ? 'un' : ''}watched`, [ total ]),
					])

					eleListItem.removeChild(eleListItem.lastChild)
					eleListItem.appendChild(progressIndicator)
				}
			}
		})
	})
	pnode.files.forEach(function addFile(cnode) {
		function setWatched(eleListItem, newIsWatched) {
			eleListItem.classList[newIsWatched ? 'add' : 'remove']('watched')

			state.set(cnode, newIsWatched)
			state.save()
		}

		addListItem({
			cnode,
			state,
			onleftclick: eleListItem => {
				setWatched(eleListItem, true)
				document.body.classList.add('modal-open')
				setTimeout(() => {
					document.body.classList.remove('modal-open')
				}, 5000)
				shell.openPath(cnode.absPath)
					.then(e => e && alert(e.message))
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

	let progressIndicator = ''
	let isWatched = false

	if (cnode.type === 'folder') {
		const { total, watched, partial } = getChildren(cnode, state)
		if (total === 0) return
		const unwatched = total - watched - partial

		progressIndicator = h('.progress', {
			title: `Unwatched: ${unwatched} | Partial: ${partial} | Watched: ${watched}`
		}, [
			watched && h('span.watched', [ watched ]),
			partial && h('span.partial', [ partial ]),
			unwatched && h('span.unwatched', [ unwatched ]),
		].filter(Boolean).flatMap((e, i) => i ? [ ':', e ] : e))

		isWatched = watched === total
	} else if (cnode.type === 'file') {
		isWatched = state.get(cnode)
		progressIndicator = h('.progress.icon')
	}
	const icon = {
		folder: '📁',
		file: '🎥',
		back: '↩',
	}[cnode.type]

	const div = h(`.list-item.${cnode.type}${isWatched ? '.watched' : ''}`, {
		onclick: eventWrapper(onleftclick),
		oncontextmenu: eventWrapper(onrightclick)
	}, [
		h('span.icon', icon),
		h('.name', { title: cnode.name }, [ cnode.prettyName || cnode.name ]),
		progressIndicator
	])
	eleList.appendChild(div)
}

const getChildren = (node, state) => {
	const folderHasFiles = node => node.folders.some(folderHasFiles) || node.files.length

	const folderIsFullyWatched = (node, state) =>
		node.folders.every(folder => folderIsFullyWatched(folder, state))
		&& node.files.every(file => Number(state.get(file)))

	const folderIsUnwatched = (node, state) =>
		node.folders.every(folder => folderIsUnwatched(folder, state))
		&& node.files.every(file => !Number(state.get(file)))

	const folderIsPartiallyWatched = (node, state) => {
		const isFullyWatched = folderIsFullyWatched(node, state)
		const isUnwatched = folderIsUnwatched(node, state)
		return !isFullyWatched && !isUnwatched
	}

	const folders = node.folders.filter(folderHasFiles)

	const total = folders.length + node.files.length
	const watched = folders.filter(folder => folderIsFullyWatched(folder, state)).length
		+ node.files.filter(file => state.get(file)).length
	const partial = sum(folders.map(folder => Number(folderIsPartiallyWatched(folder, state))))

	return { total, watched, partial }
}

const sum = arr => arr.reduce((a, b) => a + b, 0)

function setChildrenWatched(state, node, newIsWatched) {
	node.folders.forEach(cnode => setChildrenWatched(state, cnode, newIsWatched))
	node.files.forEach(cnode => state.set(cnode, newIsWatched))
}
function prettyPath(pnode) {
	return getAncestry(pnode)
		.map(node => node.prettyName)
		.reverse()
		.join(' | ') // en dash –
}

function getAncestry(cnode) {
	const parents = []
	while (cnode) {
		parents.unshift(cnode)
		cnode = cnode.parent
	}
	return parents
}
