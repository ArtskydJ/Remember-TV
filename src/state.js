export default function watchedState(store, key) {
	const stateObj = store.get(key, {})

	return {
		get,
		set,
		save
		// setFromFileObj,
	}

	function get(node) {
		if (stateObj[node.absPath] === undefined) {
			stateObj[node.absPath] = null
		}
		return stateObj[node.absPath]
	}

	function set(node, value) {
		stateObj[node.absPath] = value
	}

	function save() {
		store.set(key, stateObj)
		return stateObj
	}
}
