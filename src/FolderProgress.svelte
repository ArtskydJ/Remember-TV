<script>
	export let progress
</script>

<span title="Watched: {progress.watched} | Partial: {progress.partial} | Unwatched: {progress.unwatched}"><!--
-->{#if progress.watched}<span class="watched">{progress.watched}</span>{#if progress.partial || progress.unwatched}:{/if}{/if}<!--
-->{#if progress.partial}<span class="partial">{progress.partial}</span>{#if progress.unwatched}:{/if}{/if}<!--
-->{#if progress.unwatched}<span class="unwatched">{progress.unwatched}</span>{/if}<!--
--></span>

<style>

	.unwatched {
		color: var(--color-progress-orange);
	}
	.partial {
		color: var(--color-progress-blue)
	}
	.watched {
		color: var(--color-progress-green);
	}
</style>
