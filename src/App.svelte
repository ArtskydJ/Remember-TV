<script>
	const electron = require('electron')
	const Store = require('electron-store')

	import readdir from './readdir.js'
	import State from './state.js'
	import ListItem from './ListItem.svelte'

	const store = new Store()
	// store.openInEditor()

	let absPath
	let node
	let block_clicks = false

	const state = State(store, 'stateObj')
	const scrollState = State(store, 'scroll')

	load()

	function load() {
		absPath = store.get('absPath')
		if (!absPath) {
			return false
		}

		setImmediate(() => {
			// Let the UI load, then run the blocking FS code
			let rootNode = readdir(absPath)
			const cwd = store.get('cwd')
			node = cwd ? getCwdNode(cwd, rootNode) : rootNode
		})
	}


	const mainProcess = electron.remote.require('./main')
	const browse_button_click = () => {
		var selectResults = mainProcess.selectDirectory()
		if (selectResults.length) {
			store.set('absPath', selectResults[0])
			store.set('cwd', selectResults[0])
			load()
		}
	}

	function byId(id) {
		return document.getElementById(id)
	}

	function getCwdNode(cwd, pnode) {
		const closerNode = pnode.folders.find(folder => cwd.startsWith(folder.absPath))
		return closerNode ? getCwdNode(cwd, closerNode) : pnode
	}

	$: node && loadNode(node)

	function loadNode(pnode) {
		store.set('cwd', pnode.absPath)

		window.scrollTo(0, scrollState.get(pnode))
		document.title = prettyPath(pnode)
		state.save()
	}

	function openFile(cnode) {
		setWatched(cnode, true)
		// block_clicks = true
		// setTimeout(() => {
		// 	block_clicks = false
		// }, 2500)
		electron.shell.openPath(cnode.absPath)
			.then(e => e && alert(e.message))
	}

	function setWatched(cnode, newIsWatched) {
		state.set(cnode, newIsWatched)
		state.save()
	}



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


	const sum = arr => arr.reduce((a, b) => a + b, 0)

	const getFolderProgress = (node, state) => {
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

		const unwatched = total - watched - partial

		return { total, watched, partial, unwatched }
	}



	// document.addEventListener('scroll', function(ev) {
	// 	console.log(ev)
	// 	console.log(`window.scrollY`, window.scrollY)
	// })
</script>

<div id="scroll-container">
	<button style="margin-top: 1em;" on:click={browse_button_click}>Browse</button>
	<span style="margin-left: 1em;">
		{absPath || '⬿ Where are your video files? Choose a folder!'}
	</span>
	<div id="list">
		{#if !node}
			Scanning... Please wait
		{:else}

			{#if node.parent}
				<ListItem
					icon="↩"
					name="Go Back"
					onleftclick={() => { node = node.parent }}/>
			{/if}

			{#each node.folders as cnode (cnode.absPath)}
				{@const progress = getFolderProgress(cnode, state)}
				{@const watchedAll = progress.total === progress.watched}

				<ListItem
					icon="📁"
					name={cnode.name}
					prettyName={cnode.prettyName}
					isWatched={watchedAll}
					onleftclick={() => { node = cnode }}
					onrightclick={() => {
						const message = `Mark all video files as ${watchedAll ? 'un' : ''}watched?`
						if (confirm(message)) {
							setChildrenWatched(state, cnode, !watchedAll)
							state.save()
							cnode = cnode
						}
					}}>

					{#if progress.total !== 0}
						<span
							class="progress"
							class:watched={watchedAll}
							title="Watched: {progress.watched} | Partial: {progress.partial} | Unwatched: {progress.unwatched}">
							{#if progress.watched}<span class="watched">{progress.watched}</span>{#if progress.partial || progress.unwatched}:{/if}{/if}<!--
							-->{#if progress.partial}<span class="partial">{progress.partial}</span>{#if progress.unwatched}:{/if}{/if}<!--
							-->{#if progress.unwatched}<span class="unwatched">{progress.unwatched}</span>{/if}
						</span>
					{/if}
				</ListItem>
			{/each}


			{#each node.files as cnode (cnode.absPath)}
				{@const watched = state.get(cnode)}
				<ListItem
					icon="🎥"
					name={cnode.name}
					prettyName={cnode.prettyName}
					isWatched={watched}
					onleftclick={() => {
						openFile(cnode)
						cnode = cnode
					}}
					onrightclick={() => {
						setWatched(cnode, !state.get(cnode))
						cnode = cnode
					}}
					>
					<span
						class="file progress"
						class:watched={watched}></span>
				</ListItem>
			{/each}
		{/if}
	</div>
</div>


<style>
	:global(body) {
		font-family: var(--font-family);
		font-size: var(--font-size);
		background-color: var(--color-main-bg);
		color: var(--color-main-text);
	}
	#scroll-container {
		margin-left: var(--size-main-margin);
		/* Scrollbar hack */
		overflow-y: scroll;
		margin-right: var(--size-scroll-margin);
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
	}
	::-webkit-scrollbar {
		width: var(--size-scroll-width);
	}
	::-webkit-scrollbar-track {
		background-color: var(--color-scroll-track);
	}
	::-webkit-scrollbar-thumb {
		background-color: var(--color-scroll-bar);
		border-radius: var(--size-border-radius);
	}
	::-webkit-scrollbar-thumb:hover {
		background-color: var(--color-scroll-bar-hover);
		border-radius: var(--size-border-radius);
	}

	#list {
		margin: 1em;
		margin-left: 0;
		margin-right: var(--size-scroll-margin);
	}

	button {
		cursor: default;
		padding: 0.5em 1em;
		background-color: var(--color-btn-bg);
		border-radius: var(--size-border-radius);
		border: none;
		color: var(--color-btn-text);
		font-size: 1em;
		font-weight: bold;
		outline: none;
	}
	button:hover {
		background-color: var(--color-btn-bg-hover);
		color: var(--color-btn-text-hover);
	}

	.progress {
		text-align: right;
	}
	.progress {
		padding: 0 0.5em;
	}
	.progress .unwatched {
		color: var(--color-progress-orange);
	}
	.progress .partial {
		color: var(--color-progress-blue)
	}
	.progress .watched {
		color: var(--color-progress-green);
	}

	.progress.file::after {
		content: '✗';
		color: var(--color-progress-orange);
	}
	.progress.file.watched::after {
		content: '✓';
		color: var(--color-progress-green);
	}
</style>
