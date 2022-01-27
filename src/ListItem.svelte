<script>
	export let icon
	export let isWatched
	export let onleftclick
	export let onrightclick
	export let prettyName = ''
	export let name
</script>

<div class="list-item" class:watched={isWatched} on:click={onleftclick} on:contextmenu={onrightclick}>
	<span class="icon">{icon}</span>
	<span class="name" title="{name}">{prettyName || name}</span>
	<slot />
</div>


<style>
	.list-item {
		display: flex;
		justify-content: space-between;
		width: 100%;
		box-sizing: border-box;
		padding: 0.1em;
		border-radius: var(--size-border-radius);
		cursor: default;
		background-color: var(--color-list-bg);
		color: var(--color-list-text);
	}
	.list-item:hover {
		background-color: var(--color-list-bg-hover);
		color: var(--color-list-text-hover);
	}
	.icon {
		display: inline-block;
		min-width: 1em;
		padding-left: 0.25em;
		padding-right: 0.5em;

		/*padding: 0 0.5em;*/
	}
	.name {
		text-align:left;
		width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.list-item.watched .name {
		color: var(--color-main-text-subtle);
	}
	.list-item.watched:hover .name {
		color: var(--color-main-text-subtle-hover);
	}
</style>
