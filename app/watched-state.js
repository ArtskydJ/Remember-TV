module.exports = function watchedState(store) {
	var stateObj = store.get('stateObj', {})

	return {
		get,
		set,
		save
		//setFromFileObj,
	}

	function get(node) {
		if (stateObj[node.absPath] === undefined) {
			stateObj[node.absPath] = false
		}
		return stateObj[node.absPath]
	}

	function set(node, value) {
		stateObj[node.absPath] = value
	}

	function save() {
		store.set('stateObj', stateObj)
		return stateObj
	}
}
