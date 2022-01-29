<script>
	export let watched
	export let style
</script>

<button class="Clickable" on:click on:contextmenu class:watched={watched} {style}>
	<slot />
</button>


<style>
	button {
		/*box-sizing: border-box;*/
		padding: 0.1em 0.2em;
		border-radius: var(--size-border-radius);
		cursor: pointer;
		border: none;
		font-family: var(--font-family);
		font-size: var(--font-size);
	}

	button {
		background-color: var(--color-list-bg);
		color: var(--color-list-text);
	}
	button:hover {
		background-color: var(--color-list-bg-hover);
		color: var(--color-list-text-hover);
	}
	button.watched {
		color: var(--color-main-text-subtle);
	}
	button.watched:hover {
		color: var(--color-main-text-subtle-hover);
	}
</style>
