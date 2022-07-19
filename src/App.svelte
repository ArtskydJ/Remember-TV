<script>
	const { shell, ipcRenderer } = require('electron')
	const Store = require('electron-store')

	import readdir from './readdir.js'
	import State from './state.js'
	import Row from './Row.svelte'
	import FolderProgress from './FolderProgress.svelte'

	const store = new Store()
	// store.openInEditor()

	let absPath
	let node

	const watchState = State(store, 'stateObj')
	// const scrollState = State(store, 'scroll')
	const starState = State(store, 'star')

	load()

	function load() {
		absPath = store.get('absPath')
		if (absPath) {
			const rootNode = readdir(absPath)
			const cwd = store.get('cwd')
			node = cwd ? getCwdNode(cwd, rootNode) : rootNode
		}
	}


	const browse_button_click = async() => {
		const directory = await ipcRenderer.invoke('selectDirectory')
		if (directory) {
			store.set('absPath', directory)
			store.set('cwd', directory)
			load()
		}
	}

	function getCwdNode(cwd, pnode) {
		const closerNode = pnode.folders.find(folder => cwd.startsWith(folder.absPath))
		return closerNode ? getCwdNode(cwd, closerNode) : pnode
	}

	$: node && loadNode(node)

	function loadNode(pnode) {
		store.set('cwd', pnode.absPath)
		// window.scrollTo(0, scrollState.get(pnode))
		watchState.save()
	}

	function openFile(cnode) {
		setWatched(cnode, true)
		shell.openPath(cnode.absPath)
			.then(e => e && alert(e.message))
	}

	function setWatched(cnode, newIsWatched) {
		watchState.set(cnode, newIsWatched)
		watchState.save()
	}

	function toggleStar(cnode) {
		const newIsStarred = !starState.get(cnode)
		starState.set(cnode, newIsStarred)
		starState.save()
		cnode = cnode
	}


	function confirmSetAllWatched(cnode, watchedAll) {
		const message = `Mark all video files as ${ watchedAll ? 'un' : '' }watched?`
		if (confirm(message)) {
			setChildrenWatched(watchState, cnode, !watchedAll)
			watchState.save()
		}
	}
	function setChildrenWatched(watchState, node, newIsWatched) {
		node.folders.forEach(cnode => setChildrenWatched(watchState, cnode, newIsWatched))
		node.files.forEach(cnode => watchState.set(cnode, newIsWatched))
	}
	// function prettyPath(pnode) {
	// 	return getAncestry(pnode)
	// 		.map(node => node.prettyName)
	// 		.reverse()
	// 		.join(' | ') // en dash –
	// }
	// function getAncestry(cnode) {
	// 	const parents = []
	// 	while (cnode) {
	// 		parents.unshift(cnode)
	// 		cnode = cnode.parent
	// 	}
	// 	return parents
	// }


	const getFolderProgress = (node, watchState) => {
		const folderHasFiles = node => node.folders.some(folderHasFiles) || node.files.length

		const folderIsFullyWatched = (node, watchState) =>
			node.folders.every(folder => folderIsFullyWatched(folder, watchState))
			&& node.files.every(file => Number(watchState.get(file)))

		const folderIsFullyUnwatched = (node, watchState) =>
			node.folders.every(folder => folderIsFullyUnwatched(folder, watchState))
			&& node.files.every(file => !Number(watchState.get(file)))

		const folders = node.folders.filter(folderHasFiles)

		const total = folders.length + node.files.length
		const watched = folders.filter(folder => folderIsFullyWatched(folder, watchState)).length
			+ node.files.filter(file => watchState.get(file)).length

		const unwatched = folders.filter(folder => folderIsFullyUnwatched(folder, watchState)).length
			+ node.files.filter(file => !watchState.get(file)).length
		const partial = total - watched - unwatched

		return { total, watched, partial, unwatched }
	}



	// document.addEventListener('scroll', function(ev) {
	// 	console.log(ev)
	// 	console.log(`window.scrollY`, window.scrollY)
	// })

	const tabIndexWatched = 1
	const tabIndexStar = 2
</script>

<div id="scroll-container">
	{#if !node || !node.parent}
		<Row style="margin:1em;">
			<button class="big" on:click={browse_button_click}>Browse</button>
			<span>
				{absPath || '⬿ Where are your video files? Choose a folder!'}
			</span>
		</Row>
	{/if}
	{#if absPath}
		<div id="list">
			{#if !node}
				Scanning... Please wait
			{:else}
				{#if node.parent}
					<Row style="margin:1em;">
						<button class="big" on:click={() => { node = node.parent }}>🡹 Parent Folder</button>
						<span style="white-space: wrap;">
							{@html node.absPath.slice(absPath.length + 1).replace(/[\\\/]/g, '<wbr>/')}
						</span>
					</Row>
				{/if}

				{#each [ 'Starred', 'All' ] as sectionName, showAll}
					{#if node.folders.some(cnode => starState.get(cnode))}
						<div style="margin: 1em 0 0.5em;">
							<Row style="justify-content: center;">
								{sectionName}
							</Row>
							<hr />
						</div>
					{/if}
					{#each node.folders as cnode (cnode.absPath)}
						{@const starred = starState.get(cnode)}
						{@const progress = getFolderProgress(cnode, watchState)}
						{@const watchedAll = progress.total === progress.watched}

						{#if progress.total !== 0 && (showAll || starred)}
							<Row>
								<button class="subtle" class:watched={watchedAll} on:click={() => { node = cnode }} style="flex-shrink:1;white-space: nowrap;overflow: hidden;text-overflow: ellipsis;">
									<span class="icon">📁</span>
									<span title="{cnode.name}" class:watched={watchedAll}>{cnode.prettyName}</span>
								</button>
								<span style="flex-grow: 1;"></span>
								<button class="subtle" tabindex={tabIndexWatched} on:click={() => {confirmSetAllWatched(cnode, watchedAll); cnode = cnode}}>
									<FolderProgress {progress} />
								</button>
								<button class="subtle" tabindex={tabIndexStar} on:click={() => {toggleStar(cnode); cnode = cnode}}>
									<span class="star" class:starred={starred}></span>
								</button>
							</Row>
						{/if}
					{/each}
				{/each}


				{#each node.files as cnode (cnode.absPath)}
					{@const watched = watchState.get(cnode)}
					<Row>
						<button class="subtle" class:watched={watched} on:click={() => { openFile(cnode); cnode = cnode }} {watched} style="flex-shrink:1;white-space: nowrap;overflow: hidden;text-overflow: ellipsis;">
							<span class="icon">🎥</span>
							<span title="{cnode.name}">{cnode.prettyName}</span>
						</button>
						<span style="flex-grow: 1;"></span>
						<button class="subtle" tabindex={tabIndexWatched} on:click={() => { setWatched(cnode, ! watchState.get(cnode)); cnode = cnode }}>
							<span class="file progress" class:watched={watched}></span>
						</button>
					</Row>
				{/each}
			{/if}
		</div>
	{/if}
</div>


<style>
	:global(body) {
		overflow-x: hidden;
	}
	#scroll-container {
		margin: 0;
		/* Scrollbar hack */
		overflow-x: hidden;
		overflow-y: scroll;
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
		margin: 0 var(--size-scroll-margin) 1em;
	}

	hr {
		margin: 0;
		border-color: var(--color-main-text);
	}

	button {
		cursor: pointer;
		border: none;
		border-radius: var(--size-border-radius);
		font-family: var(--font-family);
		font-size: var(--font-size);

		outline: none !important;
	}
	button:focus-visible {
		outline: 2px solid var(--color-btn-text-hover) !important;
		z-index: 1;
	}

	button.big {
		padding: 0.5em 1em;
		background-color: var(--color-btn-bg);
		color: var(--color-btn-text);
		font-weight: bold;
		white-space: nowrap;
	}
	button:hover {
		background-color: var(--color-btn-bg-hover);
		color: var(--color-btn-text-hover);
	}


	button.subtle {
		/*box-sizing: border-box;*/
		padding: 0.1em 0.2em;
		cursor: pointer;
	}

	button.subtle {
		background-color: var(--color-list-bg);
		color: var(--color-list-text);
	}
	button.subtle:hover {
		background-color: var(--color-list-bg-hover);
		color: var(--color-list-text-hover);
	}
	button.subtle.watched {
		color: var(--color-main-text-subtle);
	}
	button.subtle.watched:hover {
		color: var(--color-main-text-subtle-hover);
	}


	.progress.file::after {
		content: '✗';
		padding: 0 0.25em;
		color: var(--color-progress-orange);
	}
	.progress.file.watched::after {
		content: '✓';
		color: var(--color-progress-green);
	}

	.star::after {
		/*content: '☆';*/
		content: '★';
		padding: 0 0.25em;
		color: var(--color-empty-star);
	}
	.star.starred::after {
		color: var(--color-filled-star);
	}

	.icon {
		display: inline-block;
		min-width: 1em;
		padding-left: 0.25em;
		padding-right: 0.5em;
		/* padding: 0 0.5em; */
	}
</style>
