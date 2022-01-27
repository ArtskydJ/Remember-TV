var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    // Extracted from https://github.com/jshttp/mime-db/blob/master/db.json

    var videoExts = new Set([
    	"3g2",
    	"3gp",
    	"3gpp",
    	"asf",
    	"asx",
    	"avi",
    	"dvb",
    	"f4v",
    	"fli",
    	"flv",
    	"fvt",
    	"h261",
    	"h263",
    	"h264",
    	"jpgm",
    	"jpgv",
    	"jpm",
    	"m1v",
    	"m2v",
    	"m4u",
    	"m4v",
    	"mj2",
    	"mjp2",
    	"mk3d",
    	"mks",
    	"mkv",
    	"mng",
    	"mov",
    	"movie",
    	"mp4",
    	"mp4v",
    	"mpe",
    	"mpeg",
    	"mpg",
    	"mpg4",
    	"mxu",
    	"ogv",
    	"pyv",
    	"qt",
    	"smv",
    	"ts",
    	"uvh",
    	"uvm",
    	"uvp",
    	"uvs",
    	"uvu",
    	"uvv",
    	"uvvh",
    	"uvvm",
    	"uvvp",
    	"uvvs",
    	"uvvu",
    	"uvvv",
    	"viv",
    	"vob",
    	"webm",
    	"wm",
    	"wmv",
    	"wmx",
    	"wvx",
    ]);

    const fs = require('fs');
    const path = require('path');

    function readdir(absPath) {
    	const name = path.basename(absPath);
    	const rootNode = {
    		name,
    		absPath,
    		parent: null,
    		prettyName: 'Remember TV'
    	};
    	return readsubdir(rootNode)
    }

    function readsubdir(pnode) {
    	pnode.folders = [];
    	pnode.files = [];

    	fs.readdirSync(pnode.absPath, { withFileTypes: true }).forEach(dirent => {
    		const cnode = {
    			name: dirent.name,
    			absPath: path.join(pnode.absPath, dirent.name),
    			parent: pnode
    		};
    		cnode.prettyName = prettyName(cnode.name);

    		const ext = path.extname(cnode.name).slice(1);
    		if (dirent.isDirectory()) {
    			cnode.type = 'folder';
    			pnode.folders.push(cnode);
    			readsubdir(cnode);
    		} else if (videoExts.has(ext)) {
    			cnode.type = 'file';
    			pnode.files.push(cnode);
    		}
    	});
    	const sortByPrettyName = (a, b) => a.prettyName.localeCompare(b.prettyName, 'en', { numeric: true });
    	pnode.folders.sort(sortByPrettyName);
    	pnode.files.sort(sortByPrettyName);
    	return pnode
    }

    function prettyName(name) {
    	return name
    		.replace(/(.+)\.[^.]+/, '$1') // remove file extension
    		.replace(/[\[\(]?\b(complete|(dvd|br|hd|web)rip|bluray|xvid|hdtv|web-dl)\b.+/i, '')
    		.replace(/[._]/g, ' ')
    		.trim()
    }

    function watchedState(store, key) {
    	const stateObj = store.get(key, {});

    	return {
    		get,
    		set,
    		save
    		// setFromFileObj,
    	}

    	function get(node) {
    		if (stateObj[node.absPath] === undefined) {
    			stateObj[node.absPath] = null;
    		}
    		return stateObj[node.absPath]
    	}

    	function set(node, value) {
    		stateObj[node.absPath] = value;
    	}

    	function save() {
    		store.set(key, stateObj);
    		return stateObj
    	}
    }

    /* src\ListItem.svelte generated by Svelte v3.46.2 */

    function create_fragment$1(ctx) {
    	let div;
    	let span0;
    	let t0;
    	let t1;
    	let span1;
    	let t2_value = (/*prettyName*/ ctx[4] || /*name*/ ctx[5]) + "";
    	let t2;
    	let t3;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[7].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], null);

    	return {
    		c() {
    			div = element("div");
    			span0 = element("span");
    			t0 = text(/*icon*/ ctx[0]);
    			t1 = space();
    			span1 = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			if (default_slot) default_slot.c();
    			attr(span0, "class", "icon svelte-1vuf40e");
    			attr(span1, "class", "name svelte-1vuf40e");
    			attr(span1, "title", /*name*/ ctx[5]);
    			attr(div, "class", "list-item svelte-1vuf40e");
    			toggle_class(div, "watched", /*isWatched*/ ctx[1]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, span0);
    			append(span0, t0);
    			append(div, t1);
    			append(div, span1);
    			append(span1, t2);
    			append(div, t3);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(div, "click", function () {
    						if (is_function(/*onleftclick*/ ctx[2])) /*onleftclick*/ ctx[2].apply(this, arguments);
    					}),
    					listen(div, "contextmenu", function () {
    						if (is_function(/*onrightclick*/ ctx[3])) /*onrightclick*/ ctx[3].apply(this, arguments);
    					})
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			if (!current || dirty & /*icon*/ 1) set_data(t0, /*icon*/ ctx[0]);
    			if ((!current || dirty & /*prettyName, name*/ 48) && t2_value !== (t2_value = (/*prettyName*/ ctx[4] || /*name*/ ctx[5]) + "")) set_data(t2, t2_value);

    			if (!current || dirty & /*name*/ 32) {
    				attr(span1, "title", /*name*/ ctx[5]);
    			}

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[6],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, null),
    						null
    					);
    				}
    			}

    			if (dirty & /*isWatched*/ 2) {
    				toggle_class(div, "watched", /*isWatched*/ ctx[1]);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { icon } = $$props;
    	let { isWatched } = $$props;
    	let { onleftclick } = $$props;
    	let { onrightclick } = $$props;
    	let { prettyName = '' } = $$props;
    	let { name } = $$props;

    	$$self.$$set = $$props => {
    		if ('icon' in $$props) $$invalidate(0, icon = $$props.icon);
    		if ('isWatched' in $$props) $$invalidate(1, isWatched = $$props.isWatched);
    		if ('onleftclick' in $$props) $$invalidate(2, onleftclick = $$props.onleftclick);
    		if ('onrightclick' in $$props) $$invalidate(3, onrightclick = $$props.onrightclick);
    		if ('prettyName' in $$props) $$invalidate(4, prettyName = $$props.prettyName);
    		if ('name' in $$props) $$invalidate(5, name = $$props.name);
    		if ('$$scope' in $$props) $$invalidate(6, $$scope = $$props.$$scope);
    	};

    	return [icon, isWatched, onleftclick, onrightclick, prettyName, name, $$scope, slots];
    }

    class ListItem extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			icon: 0,
    			isWatched: 1,
    			onleftclick: 2,
    			onrightclick: 3,
    			prettyName: 4,
    			name: 5
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.46.2 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[20] = list[i];
    	child_ctx[22] = list;
    	child_ctx[23] = i;
    	const constants_0 = /*state*/ child_ctx[2].get(/*cnode*/ child_ctx[20]);
    	child_ctx[21] = constants_0;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[20] = list[i];
    	child_ctx[26] = list;
    	child_ctx[27] = i;
    	const constants_0 = /*getFolderProgress*/ child_ctx[6](/*cnode*/ child_ctx[20], /*state*/ child_ctx[2]);
    	child_ctx[24] = constants_0;
    	const constants_1 = /*progress*/ child_ctx[24].total === /*progress*/ child_ctx[24].watched;
    	child_ctx[25] = constants_1;
    	return child_ctx;
    }

    // (149:2) {:else}
    function create_else_block(ctx) {
    	let t0;
    	let each_blocks_1 = [];
    	let each0_lookup = new Map();
    	let t1;
    	let each_blocks = [];
    	let each1_lookup = new Map();
    	let each1_anchor;
    	let current;
    	let if_block = /*node*/ ctx[0].parent && create_if_block_7(ctx);
    	let each_value_1 = /*node*/ ctx[0].folders;
    	const get_key = ctx => /*cnode*/ ctx[20].absPath;

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each0_lookup.set(key, each_blocks_1[i] = create_each_block_1(key, child_ctx));
    	}

    	let each_value = /*node*/ ctx[0].files;
    	const get_key_1 = ctx => /*cnode*/ ctx[20].absPath;

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key_1(child_ctx);
    		each1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	return {
    		c() {
    			if (if_block) if_block.c();
    			t0 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each1_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, t0, anchor);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(target, anchor);
    			}

    			insert(target, t1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each1_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (/*node*/ ctx[0].parent) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*node*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_7(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t0.parentNode, t0);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (dirty & /*node, getFolderProgress, state, confirm, setChildrenWatched*/ 69) {
    				each_value_1 = /*node*/ ctx[0].folders;
    				group_outros();
    				each_blocks_1 = update_keyed_each(each_blocks_1, dirty, get_key, 1, ctx, each_value_1, each0_lookup, t1.parentNode, outro_and_destroy_block, create_each_block_1, t1, get_each_context_1);
    				check_outros();
    			}

    			if (dirty & /*node, state, openFile, setWatched*/ 53) {
    				each_value = /*node*/ ctx[0].files;
    				group_outros();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key_1, 1, ctx, each_value, each1_lookup, each1_anchor.parentNode, outro_and_destroy_block, create_each_block, each1_anchor, get_each_context);
    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out(each_blocks_1[i]);
    			}

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(t0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].d(detaching);
    			}

    			if (detaching) detach(t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach(each1_anchor);
    		}
    	};
    }

    // (147:2) {#if !node}
    function create_if_block(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Scanning... Please wait");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (151:3) {#if node.parent}
    function create_if_block_7(ctx) {
    	let listitem;
    	let current;

    	listitem = new ListItem({
    			props: {
    				icon: "↩",
    				name: "Go Back",
    				onleftclick: /*func*/ ctx[7]
    			}
    		});

    	return {
    		c() {
    			create_component(listitem.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(listitem, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const listitem_changes = {};
    			if (dirty & /*node*/ 1) listitem_changes.onleftclick = /*func*/ ctx[7];
    			listitem.$set(listitem_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(listitem.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(listitem.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(listitem, detaching);
    		}
    	};
    }

    // (177:5) {#if progress.total !== 0}
    function create_if_block_1(ctx) {
    	let span;
    	let if_block0_anchor;
    	let if_block1_anchor;
    	let span_title_value;
    	let if_block0 = /*progress*/ ctx[24].watched && create_if_block_5(ctx);
    	let if_block1 = /*progress*/ ctx[24].partial && create_if_block_3(ctx);
    	let if_block2 = /*progress*/ ctx[24].unwatched && create_if_block_2(ctx);

    	return {
    		c() {
    			span = element("span");
    			if (if_block0) if_block0.c();
    			if_block0_anchor = empty();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			if (if_block2) if_block2.c();
    			attr(span, "class", "progress svelte-1p2cmsd");
    			attr(span, "title", span_title_value = "Watched: " + /*progress*/ ctx[24].watched + " | Partial: " + /*progress*/ ctx[24].partial + " | Unwatched: " + /*progress*/ ctx[24].unwatched);
    			toggle_class(span, "watched", /*watchedAll*/ ctx[25]);
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			if (if_block0) if_block0.m(span, null);
    			append(span, if_block0_anchor);
    			if (if_block1) if_block1.m(span, null);
    			append(span, if_block1_anchor);
    			if (if_block2) if_block2.m(span, null);
    		},
    		p(ctx, dirty) {
    			if (/*progress*/ ctx[24].watched) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_5(ctx);
    					if_block0.c();
    					if_block0.m(span, if_block0_anchor);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*progress*/ ctx[24].partial) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(span, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*progress*/ ctx[24].unwatched) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_2(ctx);
    					if_block2.c();
    					if_block2.m(span, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty & /*node*/ 1 && span_title_value !== (span_title_value = "Watched: " + /*progress*/ ctx[24].watched + " | Partial: " + /*progress*/ ctx[24].partial + " | Unwatched: " + /*progress*/ ctx[24].unwatched)) {
    				attr(span, "title", span_title_value);
    			}

    			if (dirty & /*getFolderProgress, node, state*/ 69) {
    				toggle_class(span, "watched", /*watchedAll*/ ctx[25]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};
    }

    // (182:7) {#if progress.watched}
    function create_if_block_5(ctx) {
    	let span;
    	let t_value = /*progress*/ ctx[24].watched + "";
    	let t;
    	let if_block_anchor;
    	let if_block = (/*progress*/ ctx[24].partial || /*progress*/ ctx[24].unwatched) && create_if_block_6();

    	return {
    		c() {
    			span = element("span");
    			t = text(t_value);
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr(span, "class", "watched svelte-1p2cmsd");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*node*/ 1 && t_value !== (t_value = /*progress*/ ctx[24].watched + "")) set_data(t, t_value);

    			if (/*progress*/ ctx[24].partial || /*progress*/ ctx[24].unwatched) {
    				if (if_block) ; else {
    					if_block = create_if_block_6();
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (182:76) {#if progress.partial || progress.unwatched}
    function create_if_block_6(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(":");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (183:10) {#if progress.partial}
    function create_if_block_3(ctx) {
    	let span;
    	let t_value = /*progress*/ ctx[24].partial + "";
    	let t;
    	let if_block_anchor;
    	let if_block = /*progress*/ ctx[24].unwatched && create_if_block_4();

    	return {
    		c() {
    			span = element("span");
    			t = text(t_value);
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr(span, "class", "partial svelte-1p2cmsd");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*node*/ 1 && t_value !== (t_value = /*progress*/ ctx[24].partial + "")) set_data(t, t_value);

    			if (/*progress*/ ctx[24].unwatched) {
    				if (if_block) ; else {
    					if_block = create_if_block_4();
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (183:79) {#if progress.unwatched}
    function create_if_block_4(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(":");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (184:10) {#if progress.unwatched}
    function create_if_block_2(ctx) {
    	let span;
    	let t_value = /*progress*/ ctx[24].unwatched + "";
    	let t;

    	return {
    		c() {
    			span = element("span");
    			t = text(t_value);
    			attr(span, "class", "unwatched svelte-1p2cmsd");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*node*/ 1 && t_value !== (t_value = /*progress*/ ctx[24].unwatched + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (162:4) <ListItem       icon="📁"       name={cnode.name}       prettyName={cnode.prettyName}       isWatched={watchedAll}       onleftclick={() => { node = cnode }}       onrightclick={() => {        const message = `Mark all video files as ${watchedAll ? 'un' : ''}watched?`        if (confirm(message)) {         setChildrenWatched(state, cnode, !watchedAll)         state.save()         cnode = cnode        }       }}>
    function create_default_slot_1(ctx) {
    	let if_block_anchor;
    	let if_block = /*progress*/ ctx[24].total !== 0 && create_if_block_1(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (/*progress*/ ctx[24].total !== 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (158:3) {#each node.folders as cnode (cnode.absPath)}
    function create_each_block_1(key_1, ctx) {
    	let first;
    	let listitem;
    	let current;

    	function func_1() {
    		return /*func_1*/ ctx[8](/*cnode*/ ctx[20]);
    	}

    	function func_2() {
    		return /*func_2*/ ctx[9](/*watchedAll*/ ctx[25], /*cnode*/ ctx[20], /*each_value_1*/ ctx[26], /*cnode_index_1*/ ctx[27]);
    	}

    	listitem = new ListItem({
    			props: {
    				icon: "📁",
    				name: /*cnode*/ ctx[20].name,
    				prettyName: /*cnode*/ ctx[20].prettyName,
    				isWatched: /*watchedAll*/ ctx[25],
    				onleftclick: func_1,
    				onrightclick: func_2,
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			first = empty();
    			create_component(listitem.$$.fragment);
    			this.first = first;
    		},
    		m(target, anchor) {
    			insert(target, first, anchor);
    			mount_component(listitem, target, anchor);
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			const listitem_changes = {};
    			if (dirty & /*node*/ 1) listitem_changes.name = /*cnode*/ ctx[20].name;
    			if (dirty & /*node*/ 1) listitem_changes.prettyName = /*cnode*/ ctx[20].prettyName;
    			if (dirty & /*node*/ 1) listitem_changes.isWatched = /*watchedAll*/ ctx[25];
    			if (dirty & /*node*/ 1) listitem_changes.onleftclick = func_1;
    			if (dirty & /*node*/ 1) listitem_changes.onrightclick = func_2;

    			if (dirty & /*$$scope, node*/ 268435457) {
    				listitem_changes.$$scope = { dirty, ctx };
    			}

    			listitem.$set(listitem_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(listitem.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(listitem.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(first);
    			destroy_component(listitem, detaching);
    		}
    	};
    }

    // (193:4) <ListItem       icon="🎥"       name={cnode.name}       prettyName={cnode.prettyName}       isWatched={watched}       onleftclick={() => {        openFile(cnode)        cnode = cnode       }}       onrightclick={() => {        setWatched(cnode, !state.get(cnode))        cnode = cnode       }}       >
    function create_default_slot(ctx) {
    	let span;
    	let t;

    	return {
    		c() {
    			span = element("span");
    			t = space();
    			attr(span, "class", "file progress svelte-1p2cmsd");
    			toggle_class(span, "watched", /*watched*/ ctx[21]);
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*state, node*/ 5) {
    				toggle_class(span, "watched", /*watched*/ ctx[21]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    			if (detaching) detach(t);
    		}
    	};
    }

    // (191:3) {#each node.files as cnode (cnode.absPath)}
    function create_each_block(key_1, ctx) {
    	let first;
    	let listitem;
    	let current;

    	function func_3() {
    		return /*func_3*/ ctx[10](/*cnode*/ ctx[20], /*each_value*/ ctx[22], /*cnode_index*/ ctx[23]);
    	}

    	function func_4() {
    		return /*func_4*/ ctx[11](/*cnode*/ ctx[20], /*each_value*/ ctx[22], /*cnode_index*/ ctx[23]);
    	}

    	listitem = new ListItem({
    			props: {
    				icon: "🎥",
    				name: /*cnode*/ ctx[20].name,
    				prettyName: /*cnode*/ ctx[20].prettyName,
    				isWatched: /*watched*/ ctx[21],
    				onleftclick: func_3,
    				onrightclick: func_4,
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			first = empty();
    			create_component(listitem.$$.fragment);
    			this.first = first;
    		},
    		m(target, anchor) {
    			insert(target, first, anchor);
    			mount_component(listitem, target, anchor);
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			const listitem_changes = {};
    			if (dirty & /*node*/ 1) listitem_changes.name = /*cnode*/ ctx[20].name;
    			if (dirty & /*node*/ 1) listitem_changes.prettyName = /*cnode*/ ctx[20].prettyName;
    			if (dirty & /*node*/ 1) listitem_changes.isWatched = /*watched*/ ctx[21];
    			if (dirty & /*node*/ 1) listitem_changes.onleftclick = func_3;
    			if (dirty & /*node*/ 1) listitem_changes.onrightclick = func_4;

    			if (dirty & /*$$scope, node*/ 268435457) {
    				listitem_changes.$$scope = { dirty, ctx };
    			}

    			listitem.$set(listitem_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(listitem.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(listitem.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(first);
    			destroy_component(listitem, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div1;
    	let button;
    	let t1;
    	let span;
    	let t2_value = (/*absPath*/ ctx[1] || '⬿ Where are your video files? Choose a folder!') + "";
    	let t2;
    	let t3;
    	let div0;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	let mounted;
    	let dispose;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (!/*node*/ ctx[0]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			div1 = element("div");
    			button = element("button");
    			button.textContent = "Browse";
    			t1 = space();
    			span = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			div0 = element("div");
    			if_block.c();
    			set_style(button, "margin-top", "1em");
    			attr(button, "class", "svelte-1p2cmsd");
    			set_style(span, "margin-left", "1em");
    			attr(span, "class", "svelte-1p2cmsd");
    			attr(div0, "id", "list");
    			attr(div0, "class", "svelte-1p2cmsd");
    			attr(div1, "id", "scroll-container");
    			attr(div1, "class", "svelte-1p2cmsd");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, button);
    			append(div1, t1);
    			append(div1, span);
    			append(span, t2);
    			append(div1, t3);
    			append(div1, div0);
    			if_blocks[current_block_type_index].m(div0, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*browse_button_click*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if ((!current || dirty & /*absPath*/ 2) && t2_value !== (t2_value = (/*absPath*/ ctx[1] || '⬿ Where are your video files? Choose a folder!') + "")) set_data(t2, t2_value);
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div0, null);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			if_blocks[current_block_type_index].d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function getCwdNode(cwd, pnode) {
    	const closerNode = pnode.folders.find(folder => cwd.startsWith(folder.absPath));
    	return closerNode ? getCwdNode(cwd, closerNode) : pnode;
    }

    function setChildrenWatched(state, node, newIsWatched) {
    	node.folders.forEach(cnode => setChildrenWatched(state, cnode, newIsWatched));
    	node.files.forEach(cnode => state.set(cnode, newIsWatched));
    }

    function prettyPath(pnode) {
    	return getAncestry(pnode).map(node => node.prettyName).reverse().join(' | '); // en dash –
    }

    function getAncestry(cnode) {
    	const parents = [];

    	while (cnode) {
    		parents.unshift(cnode);
    		cnode = cnode.parent;
    	}

    	return parents;
    }

    function instance($$self, $$props, $$invalidate) {
    	const electron = require('electron');
    	const Store = require('electron-store');
    	const store = new Store();

    	// store.openInEditor()
    	let absPath;

    	let node;
    	const state = watchedState(store, 'stateObj');
    	const scrollState = watchedState(store, 'scroll');
    	load();

    	function load() {
    		$$invalidate(1, absPath = store.get('absPath'));

    		if (!absPath) {
    			return false;
    		}

    		setImmediate(() => {
    			// Let the UI load, then run the blocking FS code
    			let rootNode = readdir(absPath);

    			const cwd = store.get('cwd');
    			$$invalidate(0, node = cwd ? getCwdNode(cwd, rootNode) : rootNode);
    		});
    	}

    	const mainProcess = electron.remote.require('./main');

    	const browse_button_click = () => {
    		var selectResults = mainProcess.selectDirectory();

    		if (selectResults.length) {
    			store.set('absPath', selectResults[0]);
    			store.set('cwd', selectResults[0]);
    			load();
    		}
    	};

    	function loadNode(pnode) {
    		store.set('cwd', pnode.absPath);
    		window.scrollTo(0, scrollState.get(pnode));
    		document.title = prettyPath(pnode);
    		state.save();
    	}

    	function openFile(cnode) {
    		setWatched(cnode, true);

    		// block_clicks = true
    		// setTimeout(() => {
    		// 	block_clicks = false
    		// }, 2500)
    		electron.shell.openPath(cnode.absPath).then(e => e && alert(e.message));
    	}

    	function setWatched(cnode, newIsWatched) {
    		state.set(cnode, newIsWatched);
    		state.save();
    	}

    	const sum = arr => arr.reduce((a, b) => a + b, 0);

    	const getFolderProgress = (node, state) => {
    		const folderHasFiles = node => node.folders.some(folderHasFiles) || node.files.length;
    		const folderIsFullyWatched = (node, state) => node.folders.every(folder => folderIsFullyWatched(folder, state)) && node.files.every(file => Number(state.get(file)));
    		const folderIsUnwatched = (node, state) => node.folders.every(folder => folderIsUnwatched(folder, state)) && node.files.every(file => !Number(state.get(file)));

    		const folderIsPartiallyWatched = (node, state) => {
    			const isFullyWatched = folderIsFullyWatched(node, state);
    			const isUnwatched = folderIsUnwatched(node, state);
    			return !isFullyWatched && !isUnwatched;
    		};

    		const folders = node.folders.filter(folderHasFiles);
    		const total = folders.length + node.files.length;
    		const watched = folders.filter(folder => folderIsFullyWatched(folder, state)).length + node.files.filter(file => state.get(file)).length;
    		const partial = sum(folders.map(folder => Number(folderIsPartiallyWatched(folder, state))));
    		const unwatched = total - watched - partial;
    		return { total, watched, partial, unwatched };
    	};

    	const func = () => {
    		$$invalidate(0, node = node.parent);
    	};

    	const func_1 = cnode => {
    		$$invalidate(0, node = cnode);
    	};

    	const func_2 = (watchedAll, cnode, each_value_1, cnode_index_1) => {
    		const message = `Mark all video files as ${watchedAll ? 'un' : ''}watched?`;

    		if (confirm(message)) {
    			setChildrenWatched(state, cnode, !watchedAll);
    			state.save();
    			$$invalidate(0, each_value_1[cnode_index_1] = cnode, node);
    		}
    	};

    	const func_3 = (cnode, each_value, cnode_index) => {
    		openFile(cnode);
    		$$invalidate(0, each_value[cnode_index] = cnode, node);
    	};

    	const func_4 = (cnode, each_value, cnode_index) => {
    		setWatched(cnode, !state.get(cnode));
    		$$invalidate(0, each_value[cnode_index] = cnode, node);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*node*/ 1) {
    			node && loadNode(node);
    		}
    	};

    	return [
    		node,
    		absPath,
    		state,
    		browse_button_click,
    		openFile,
    		setWatched,
    		getFolderProgress,
    		func,
    		func_1,
    		func_2,
    		func_3,
    		func_4
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

})();
