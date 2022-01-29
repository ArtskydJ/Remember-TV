<script>
	export let style
</script>

<div class="Row" {style}><slot/></div>

<style>
	div {
		display: flex;
		gap: 0.5em;
		flex-wrap: nowrap;
		/*max-width: 100%;*/
		user-select: none;
		justify-content: flex-start;
		align-items: center;
	}
</style>
