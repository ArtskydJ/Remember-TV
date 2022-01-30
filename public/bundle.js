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
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
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
    		cnode.prettyName = prettyName(cnode);

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

    function prettyName(cnode) {
    	// const parentFileNameRegex = new RegExp(`^((${getParents(cnode).map(pnode => pnode.name).join('|')}) ?)+`)
    	const fileExtRegex = new RegExp(`\\.(${[ ...videoExts ].join('|')})$`);
    	return cnode.name
    		// .replace(parentFileNameRegex, '') // remove parent folder names
    		.replace(fileExtRegex, '') // remove file extension
    		.replace(/[._]/g, ' ')
    		// .replace(/\b(complete|(dvd|br|hd|web)rip|bluray|xvid|hdtv|web-dl)\b.+/i, '')
    		.trim()
    }

    // function getParents(cnode) {
    // 	let node = { ...cnode }
    // 	const parents = []
    // 	while (node.parent) {
    // 		node = node.parent
    // 		parents.push(node)
    // 	}
    // 	return parents
    // }

    function nodeState(store, key) {
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

    /* src\Row.svelte generated by Svelte v3.46.2 */

    function create_fragment$2(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	return {
    		c() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr(div, "class", "Row svelte-52eppy");
    			attr(div, "style", /*style*/ ctx[0]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*style*/ 1) {
    				attr(div, "style", /*style*/ ctx[0]);
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
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { style } = $$props;

    	$$self.$$set = $$props => {
    		if ('style' in $$props) $$invalidate(0, style = $$props.style);
    		if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	return [style, $$scope, slots];
    }

    class Row extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { style: 0 });
    	}
    }

    /* src\FolderProgress.svelte generated by Svelte v3.46.2 */

    function create_if_block_3$1(ctx) {
    	let span;
    	let t_value = /*progress*/ ctx[0].watched + "";
    	let t;
    	let if_block_anchor;
    	let if_block = (/*progress*/ ctx[0].partial || /*progress*/ ctx[0].unwatched) && create_if_block_4$1();

    	return {
    		c() {
    			span = element("span");
    			t = text(t_value);
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr(span, "class", "watched svelte-vczbpf");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*progress*/ 1 && t_value !== (t_value = /*progress*/ ctx[0].watched + "")) set_data(t, t_value);

    			if (/*progress*/ ctx[0].partial || /*progress*/ ctx[0].unwatched) {
    				if (if_block) ; else {
    					if_block = create_if_block_4$1();
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

    // (6:72) {#if progress.partial || progress.unwatched}
    function create_if_block_4$1(ctx) {
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

    // (7:3) {#if progress.partial}
    function create_if_block_1$1(ctx) {
    	let span;
    	let t_value = /*progress*/ ctx[0].partial + "";
    	let t;
    	let if_block_anchor;
    	let if_block = /*progress*/ ctx[0].unwatched && create_if_block_2$1();

    	return {
    		c() {
    			span = element("span");
    			t = text(t_value);
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr(span, "class", "partial svelte-vczbpf");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*progress*/ 1 && t_value !== (t_value = /*progress*/ ctx[0].partial + "")) set_data(t, t_value);

    			if (/*progress*/ ctx[0].unwatched) {
    				if (if_block) ; else {
    					if_block = create_if_block_2$1();
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

    // (7:72) {#if progress.unwatched}
    function create_if_block_2$1(ctx) {
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

    // (8:3) {#if progress.unwatched}
    function create_if_block$1(ctx) {
    	let span;
    	let t_value = /*progress*/ ctx[0].unwatched + "";
    	let t;

    	return {
    		c() {
    			span = element("span");
    			t = text(t_value);
    			attr(span, "class", "unwatched svelte-vczbpf");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*progress*/ 1 && t_value !== (t_value = /*progress*/ ctx[0].unwatched + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let span;
    	let if_block0_anchor;
    	let if_block1_anchor;
    	let span_title_value;
    	let if_block0 = /*progress*/ ctx[0].watched && create_if_block_3$1(ctx);
    	let if_block1 = /*progress*/ ctx[0].partial && create_if_block_1$1(ctx);
    	let if_block2 = /*progress*/ ctx[0].unwatched && create_if_block$1(ctx);

    	return {
    		c() {
    			span = element("span");
    			if (if_block0) if_block0.c();
    			if_block0_anchor = empty();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			if (if_block2) if_block2.c();
    			attr(span, "title", span_title_value = "Watched: " + /*progress*/ ctx[0].watched + " | Partial: " + /*progress*/ ctx[0].partial + " | Unwatched: " + /*progress*/ ctx[0].unwatched);
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			if (if_block0) if_block0.m(span, null);
    			append(span, if_block0_anchor);
    			if (if_block1) if_block1.m(span, null);
    			append(span, if_block1_anchor);
    			if (if_block2) if_block2.m(span, null);
    		},
    		p(ctx, [dirty]) {
    			if (/*progress*/ ctx[0].watched) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_3$1(ctx);
    					if_block0.c();
    					if_block0.m(span, if_block0_anchor);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*progress*/ ctx[0].partial) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					if_block1.m(span, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*progress*/ ctx[0].unwatched) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$1(ctx);
    					if_block2.c();
    					if_block2.m(span, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty & /*progress*/ 1 && span_title_value !== (span_title_value = "Watched: " + /*progress*/ ctx[0].watched + " | Partial: " + /*progress*/ ctx[0].partial + " | Unwatched: " + /*progress*/ ctx[0].unwatched)) {
    				attr(span, "title", span_title_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(span);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { progress } = $$props;

    	$$self.$$set = $$props => {
    		if ('progress' in $$props) $$invalidate(0, progress = $$props.progress);
    	};

    	return [progress];
    }

    class FolderProgress extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { progress: 0 });
    	}
    }

    /* src\App.svelte generated by Svelte v3.46.2 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	child_ctx[27] = list;
    	child_ctx[28] = i;
    	const constants_0 = /*watchState*/ child_ctx[2].get(/*cnode*/ child_ctx[25]);
    	child_ctx[26] = constants_0;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[29] = list[i];
    	child_ctx[31] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	child_ctx[35] = list;
    	child_ctx[36] = i;
    	const constants_0 = /*starState*/ child_ctx[3].get(/*cnode*/ child_ctx[25]);
    	child_ctx[32] = constants_0;
    	const constants_1 = /*getFolderProgress*/ child_ctx[9](/*cnode*/ child_ctx[25], /*watchState*/ child_ctx[2]);
    	child_ctx[33] = constants_1;
    	const constants_2 = /*progress*/ child_ctx[33].total === /*progress*/ child_ctx[33].watched;
    	child_ctx[34] = constants_2;
    	return child_ctx;
    }

    // (137:1) {#if !node || !node.parent}
    function create_if_block_5(ctx) {
    	let row;
    	let current;

    	row = new Row({
    			props: {
    				style: "margin:1em;",
    				$$slots: { default: [create_default_slot_4] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(row.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(row, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const row_changes = {};

    			if (dirty[0] & /*absPath*/ 2 | dirty[1] & /*$$scope*/ 64) {
    				row_changes.$$scope = { dirty, ctx };
    			}

    			row.$set(row_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(row.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(row.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(row, detaching);
    		}
    	};
    }

    // (138:2) <Row style="margin:1em;">
    function create_default_slot_4(ctx) {
    	let button;
    	let t1;
    	let span;
    	let t2_value = (/*absPath*/ ctx[1] || '⬿ Where are your video files? Choose a folder!') + "";
    	let t2;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "Browse";
    			t1 = space();
    			span = element("span");
    			t2 = text(t2_value);
    			attr(button, "class", "big svelte-1riw5vd");
    			attr(span, "class", "svelte-1riw5vd");
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);
    			insert(target, t1, anchor);
    			insert(target, span, anchor);
    			append(span, t2);

    			if (!mounted) {
    				dispose = listen(button, "click", /*browse_button_click*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*absPath*/ 2 && t2_value !== (t2_value = (/*absPath*/ ctx[1] || '⬿ Where are your video files? Choose a folder!') + "")) set_data(t2, t2_value);
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			if (detaching) detach(t1);
    			if (detaching) detach(span);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (145:1) {#if absPath}
    function create_if_block(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block_1, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (!/*node*/ ctx[0]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			div = element("div");
    			if_block.c();
    			attr(div, "id", "list");
    			attr(div, "class", "svelte-1riw5vd");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			current = true;
    		},
    		p(ctx, dirty) {
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
    				if_block.m(div, null);
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
    			if (detaching) detach(div);
    			if_blocks[current_block_type_index].d();
    		}
    	};
    }

    // (149:3) {:else}
    function create_else_block(ctx) {
    	let t0;
    	let t1;
    	let each_blocks = [];
    	let each1_lookup = new Map();
    	let each1_anchor;
    	let current;
    	let if_block = /*node*/ ctx[0].parent && create_if_block_4(ctx);
    	let each_value_1 = ['Starred', 'All'];
    	let each_blocks_1 = [];

    	for (let i = 0; i < 2; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	let each_value = /*node*/ ctx[0].files;
    	const get_key = ctx => /*cnode*/ ctx[25].absPath;

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	return {
    		c() {
    			if (if_block) if_block.c();
    			t0 = space();

    			for (let i = 0; i < 2; i += 1) {
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

    			for (let i = 0; i < 2; i += 1) {
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

    					if (dirty[0] & /*node*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_4(ctx);
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

    			if (dirty[0] & /*node, toggleStar, starState, confirmSetAllWatched, getFolderProgress, watchState*/ 909) {
    				each_value_1 = ['Starred', 'All'];
    				let i;

    				for (i = 0; i < 2; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						transition_in(each_blocks_1[i], 1);
    						each_blocks_1[i].m(t1.parentNode, t1);
    					}
    				}

    				group_outros();

    				for (i = 2; i < 2; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (dirty[0] & /*setWatched, node, watchState, openFile*/ 101) {
    				each_value = /*node*/ ctx[0].files;
    				group_outros();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each1_lookup, each1_anchor.parentNode, outro_and_destroy_block, create_each_block, each1_anchor, get_each_context);
    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);

    			for (let i = 0; i < 2; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			each_blocks_1 = each_blocks_1.filter(Boolean);

    			for (let i = 0; i < 2; i += 1) {
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
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach(t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach(each1_anchor);
    		}
    	};
    }

    // (147:3) {#if !node}
    function create_if_block_1(ctx) {
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

    // (150:4) {#if node.parent}
    function create_if_block_4(ctx) {
    	let row;
    	let current;

    	row = new Row({
    			props: {
    				style: "margin:1em;",
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(row.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(row, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const row_changes = {};

    			if (dirty[0] & /*node, absPath*/ 3 | dirty[1] & /*$$scope*/ 64) {
    				row_changes.$$scope = { dirty, ctx };
    			}

    			row.$set(row_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(row.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(row.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(row, detaching);
    		}
    	};
    }

    // (151:5) <Row style="margin:1em;">
    function create_default_slot_3(ctx) {
    	let button;
    	let t1;
    	let span;
    	let raw_value = /*node*/ ctx[0].absPath.slice(/*absPath*/ ctx[1].length + 1).replace(/[\\\/]/g, '<wbr>/') + "";
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "🡹 Parent Folder";
    			t1 = space();
    			span = element("span");
    			attr(button, "class", "big svelte-1riw5vd");
    			set_style(span, "white-space", "wrap");
    			attr(span, "class", "svelte-1riw5vd");
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);
    			insert(target, t1, anchor);
    			insert(target, span, anchor);
    			span.innerHTML = raw_value;

    			if (!mounted) {
    				dispose = listen(button, "click", /*click_handler*/ ctx[11]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*node, absPath*/ 3 && raw_value !== (raw_value = /*node*/ ctx[0].absPath.slice(/*absPath*/ ctx[1].length + 1).replace(/[\\\/]/g, '<wbr>/') + "")) span.innerHTML = raw_value;		},
    		d(detaching) {
    			if (detaching) detach(button);
    			if (detaching) detach(t1);
    			if (detaching) detach(span);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (160:5) {#if node.folders.some(cnode => starState.get(cnode))}
    function create_if_block_3(ctx) {
    	let div;
    	let row;
    	let t;
    	let hr;
    	let current;

    	row = new Row({
    			props: {
    				style: "justify-content: center;",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			div = element("div");
    			create_component(row.$$.fragment);
    			t = space();
    			hr = element("hr");
    			attr(hr, "class", "svelte-1riw5vd");
    			set_style(div, "margin", "1em 0 0.5em");
    			attr(div, "class", "svelte-1riw5vd");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(row, div, null);
    			append(div, t);
    			append(div, hr);
    			current = true;
    		},
    		i(local) {
    			if (current) return;
    			transition_in(row.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(row.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(row);
    		}
    	};
    }

    // (162:7) <Row style="justify-content: center;">
    function create_default_slot_2(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*sectionName*/ ctx[29]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (173:6) {#if progress.total !== 0 && (showAll || starred)}
    function create_if_block_2(ctx) {
    	let row;
    	let current;

    	row = new Row({
    			props: {
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(row.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(row, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const row_changes = {};

    			if (dirty[0] & /*node*/ 1 | dirty[1] & /*$$scope*/ 64) {
    				row_changes.$$scope = { dirty, ctx };
    			}

    			row.$set(row_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(row.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(row.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(row, detaching);
    		}
    	};
    }

    // (174:7) <Row>
    function create_default_slot_1(ctx) {
    	let button0;
    	let span0;
    	let t1;
    	let span1;
    	let t2_value = /*cnode*/ ctx[25].prettyName + "";
    	let t2;
    	let span1_title_value;
    	let t3;
    	let span2;
    	let t4;
    	let button1;
    	let folderprogress;
    	let t5;
    	let button2;
    	let span3;
    	let current;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[12](/*cnode*/ ctx[25]);
    	}

    	folderprogress = new FolderProgress({
    			props: { progress: /*progress*/ ctx[33] }
    		});

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[13](/*cnode*/ ctx[25], /*watchedAll*/ ctx[34], /*each_value_2*/ ctx[35], /*cnode_index_1*/ ctx[36]);
    	}

    	function click_handler_3() {
    		return /*click_handler_3*/ ctx[14](/*cnode*/ ctx[25], /*each_value_2*/ ctx[35], /*cnode_index_1*/ ctx[36]);
    	}

    	return {
    		c() {
    			button0 = element("button");
    			span0 = element("span");
    			span0.textContent = "📁";
    			t1 = space();
    			span1 = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			span2 = element("span");
    			t4 = space();
    			button1 = element("button");
    			create_component(folderprogress.$$.fragment);
    			t5 = space();
    			button2 = element("button");
    			span3 = element("span");
    			attr(span0, "class", "icon svelte-1riw5vd");
    			attr(span1, "title", span1_title_value = /*cnode*/ ctx[25].name);
    			attr(span1, "class", "svelte-1riw5vd");
    			toggle_class(span1, "watched", /*watchedAll*/ ctx[34]);
    			attr(button0, "class", "subtle svelte-1riw5vd");
    			set_style(button0, "flex-shrink", "1");
    			set_style(button0, "white-space", "nowrap");
    			set_style(button0, "overflow", "hidden");
    			set_style(button0, "text-overflow", "ellipsis");
    			toggle_class(button0, "watched", /*watchedAll*/ ctx[34]);
    			set_style(span2, "flex-grow", "1");
    			attr(span2, "class", "svelte-1riw5vd");
    			attr(button1, "class", "subtle svelte-1riw5vd");
    			attr(button1, "tabindex", "1");
    			attr(span3, "class", "star svelte-1riw5vd");
    			toggle_class(span3, "starred", /*starred*/ ctx[32]);
    			attr(button2, "class", "subtle svelte-1riw5vd");
    			attr(button2, "tabindex", "2");
    		},
    		m(target, anchor) {
    			insert(target, button0, anchor);
    			append(button0, span0);
    			append(button0, t1);
    			append(button0, span1);
    			append(span1, t2);
    			insert(target, t3, anchor);
    			insert(target, span2, anchor);
    			insert(target, t4, anchor);
    			insert(target, button1, anchor);
    			mount_component(folderprogress, button1, null);
    			insert(target, t5, anchor);
    			insert(target, button2, anchor);
    			append(button2, span3);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", click_handler_1),
    					listen(button1, "click", click_handler_2),
    					listen(button2, "click", click_handler_3)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty[0] & /*node*/ 1) && t2_value !== (t2_value = /*cnode*/ ctx[25].prettyName + "")) set_data(t2, t2_value);

    			if (!current || dirty[0] & /*node*/ 1 && span1_title_value !== (span1_title_value = /*cnode*/ ctx[25].name)) {
    				attr(span1, "title", span1_title_value);
    			}

    			if (dirty[0] & /*getFolderProgress, node, watchState*/ 517) {
    				toggle_class(span1, "watched", /*watchedAll*/ ctx[34]);
    			}

    			if (dirty[0] & /*getFolderProgress, node, watchState*/ 517) {
    				toggle_class(button0, "watched", /*watchedAll*/ ctx[34]);
    			}

    			const folderprogress_changes = {};
    			if (dirty[0] & /*node*/ 1) folderprogress_changes.progress = /*progress*/ ctx[33];
    			folderprogress.$set(folderprogress_changes);

    			if (dirty[0] & /*starState, node*/ 9) {
    				toggle_class(span3, "starred", /*starred*/ ctx[32]);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(folderprogress.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(folderprogress.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(button0);
    			if (detaching) detach(t3);
    			if (detaching) detach(span2);
    			if (detaching) detach(t4);
    			if (detaching) detach(button1);
    			destroy_component(folderprogress);
    			if (detaching) detach(t5);
    			if (detaching) detach(button2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (168:5) {#each node.folders as cnode (cnode.absPath)}
    function create_each_block_2(key_1, ctx) {
    	let first;
    	let if_block_anchor;
    	let current;
    	let if_block = /*progress*/ ctx[33].total !== 0 && (/*showAll*/ ctx[31] || /*starred*/ ctx[32]) && create_if_block_2(ctx);

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			first = empty();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.first = first;
    		},
    		m(target, anchor) {
    			insert(target, first, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*progress*/ ctx[33].total !== 0 && (/*showAll*/ ctx[31] || /*starred*/ ctx[32])) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*node*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
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
    			if (detaching) detach(first);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (159:4) {#each [ 'Starred', 'All' ] as sectionName, showAll}
    function create_each_block_1(ctx) {
    	let show_if = /*node*/ ctx[0].folders.some(/*func*/ ctx[10]);
    	let t;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;
    	let if_block = show_if && create_if_block_3(ctx);
    	let each_value_2 = /*node*/ ctx[0].folders;
    	const get_key = ctx => /*cnode*/ ctx[25].absPath;

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		let child_ctx = get_each_context_2(ctx, each_value_2, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block_2(key, child_ctx));
    	}

    	return {
    		c() {
    			if (if_block) if_block.c();
    			t = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, t, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*node*/ 1) show_if = /*node*/ ctx[0].folders.some(/*func*/ ctx[10]);

    			if (show_if) {
    				if (if_block) {
    					if (dirty[0] & /*node*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_3(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t.parentNode, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (dirty[0] & /*toggleStar, node, starState, confirmSetAllWatched, getFolderProgress, watchState*/ 909) {
    				each_value_2 = /*node*/ ctx[0].folders;
    				group_outros();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_2, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block_2, each_1_anchor, get_each_context_2);
    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);

    			for (let i = 0; i < each_value_2.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(t);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (194:5) <Row>
    function create_default_slot(ctx) {
    	let button0;
    	let span0;
    	let t1;
    	let span1;
    	let t2_value = /*cnode*/ ctx[25].prettyName + "";
    	let t2;
    	let span1_title_value;
    	let button0_watched_value;
    	let t3;
    	let span2;
    	let t4;
    	let button1;
    	let span3;
    	let t5;
    	let mounted;
    	let dispose;

    	function click_handler_4() {
    		return /*click_handler_4*/ ctx[15](/*cnode*/ ctx[25], /*each_value*/ ctx[27], /*cnode_index*/ ctx[28]);
    	}

    	function click_handler_5() {
    		return /*click_handler_5*/ ctx[16](/*cnode*/ ctx[25], /*each_value*/ ctx[27], /*cnode_index*/ ctx[28]);
    	}

    	return {
    		c() {
    			button0 = element("button");
    			span0 = element("span");
    			span0.textContent = "🎥";
    			t1 = space();
    			span1 = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			span2 = element("span");
    			t4 = space();
    			button1 = element("button");
    			span3 = element("span");
    			t5 = space();
    			attr(span0, "class", "icon svelte-1riw5vd");
    			attr(span1, "title", span1_title_value = /*cnode*/ ctx[25].name);
    			attr(span1, "class", "svelte-1riw5vd");
    			attr(button0, "class", "subtle svelte-1riw5vd");
    			attr(button0, "watched", button0_watched_value = /*watched*/ ctx[26]);
    			set_style(button0, "flex-shrink", "1");
    			set_style(button0, "white-space", "nowrap");
    			set_style(button0, "overflow", "hidden");
    			set_style(button0, "text-overflow", "ellipsis");
    			toggle_class(button0, "watched", /*watched*/ ctx[26]);
    			set_style(span2, "flex-grow", "1");
    			attr(span2, "class", "svelte-1riw5vd");
    			attr(span3, "class", "file progress svelte-1riw5vd");
    			toggle_class(span3, "watched", /*watched*/ ctx[26]);
    			attr(button1, "class", "subtle svelte-1riw5vd");
    			attr(button1, "tabindex", "2");
    		},
    		m(target, anchor) {
    			insert(target, button0, anchor);
    			append(button0, span0);
    			append(button0, t1);
    			append(button0, span1);
    			append(span1, t2);
    			insert(target, t3, anchor);
    			insert(target, span2, anchor);
    			insert(target, t4, anchor);
    			insert(target, button1, anchor);
    			append(button1, span3);
    			insert(target, t5, anchor);

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", click_handler_4),
    					listen(button1, "click", click_handler_5)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*node*/ 1 && t2_value !== (t2_value = /*cnode*/ ctx[25].prettyName + "")) set_data(t2, t2_value);

    			if (dirty[0] & /*node*/ 1 && span1_title_value !== (span1_title_value = /*cnode*/ ctx[25].name)) {
    				attr(span1, "title", span1_title_value);
    			}

    			if (dirty[0] & /*node*/ 1 && button0_watched_value !== (button0_watched_value = /*watched*/ ctx[26])) {
    				attr(button0, "watched", button0_watched_value);
    			}

    			if (dirty[0] & /*watchState, node*/ 5) {
    				toggle_class(button0, "watched", /*watched*/ ctx[26]);
    			}

    			if (dirty[0] & /*watchState, node*/ 5) {
    				toggle_class(span3, "watched", /*watched*/ ctx[26]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button0);
    			if (detaching) detach(t3);
    			if (detaching) detach(span2);
    			if (detaching) detach(t4);
    			if (detaching) detach(button1);
    			if (detaching) detach(t5);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (192:4) {#each node.files as cnode (cnode.absPath)}
    function create_each_block(key_1, ctx) {
    	let first;
    	let row;
    	let current;

    	row = new Row({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			first = empty();
    			create_component(row.$$.fragment);
    			this.first = first;
    		},
    		m(target, anchor) {
    			insert(target, first, anchor);
    			mount_component(row, target, anchor);
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			const row_changes = {};

    			if (dirty[0] & /*node*/ 1 | dirty[1] & /*$$scope*/ 64) {
    				row_changes.$$scope = { dirty, ctx };
    			}

    			row.$set(row_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(row.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(row.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(first);
    			destroy_component(row, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let t;
    	let current;
    	let if_block0 = (!/*node*/ ctx[0] || !/*node*/ ctx[0].parent) && create_if_block_5(ctx);
    	let if_block1 = /*absPath*/ ctx[1] && create_if_block(ctx);

    	return {
    		c() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			attr(div, "id", "scroll-container");
    			attr(div, "class", "svelte-1riw5vd");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t);
    			if (if_block1) if_block1.m(div, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (!/*node*/ ctx[0] || !/*node*/ ctx[0].parent) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty[0] & /*node*/ 1) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_5(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div, t);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*absPath*/ ctx[1]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty[0] & /*absPath*/ 2) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div, null);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    		}
    	};
    }

    function getCwdNode(cwd, pnode) {
    	const closerNode = pnode.folders.find(folder => cwd.startsWith(folder.absPath));
    	return closerNode ? getCwdNode(cwd, closerNode) : pnode;
    }

    function setChildrenWatched(watchState, node, newIsWatched) {
    	node.folders.forEach(cnode => setChildrenWatched(watchState, cnode, newIsWatched));
    	node.files.forEach(cnode => watchState.set(cnode, newIsWatched));
    }

    function instance($$self, $$props, $$invalidate) {
    	const electron = require('electron');
    	const Store = require('electron-store');
    	const store = new Store();

    	// store.openInEditor()
    	let absPath;

    	let node;
    	const watchState = nodeState(store, 'stateObj');
    	nodeState(store, 'scroll');
    	const starState = nodeState(store, 'star');
    	load();

    	function load() {
    		$$invalidate(1, absPath = store.get('absPath'));

    		if (absPath) {
    			let rootNode = readdir(absPath);
    			const cwd = store.get('cwd');
    			$$invalidate(0, node = cwd ? getCwdNode(cwd, rootNode) : rootNode);
    		}
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

    		// window.scrollTo(0, scrollwatchState.get(pnode))
    		watchState.save();
    	}

    	function openFile(cnode) {
    		setWatched(cnode, true);
    		electron.shell.openPath(cnode.absPath).then(e => e && alert(e.message));
    	}

    	function setWatched(cnode, newIsWatched) {
    		watchState.set(cnode, newIsWatched);
    		watchState.save();
    	}

    	function toggleStar(cnode) {
    		const newIsStarred = !starState.get(cnode);
    		starState.set(cnode, newIsStarred);
    		starState.save();
    		cnode = cnode;
    	}

    	function confirmSetAllWatched(cnode, watchedAll) {
    		const message = `Mark all video files as ${watchedAll ? 'un' : ''}watched?`;

    		if (confirm(message)) {
    			setChildrenWatched(watchState, cnode, !watchedAll);
    			watchState.save();
    		}
    	}

    	const getFolderProgress = (node, watchState) => {
    		const folderHasFiles = node => node.folders.some(folderHasFiles) || node.files.length;
    		const folderIsFullyWatched = (node, watchState) => node.folders.every(folder => folderIsFullyWatched(folder, watchState)) && node.files.every(file => Number(watchState.get(file)));
    		const folderIsFullyUnwatched = (node, watchState) => node.folders.every(folder => folderIsFullyUnwatched(folder, watchState)) && node.files.every(file => !Number(watchState.get(file)));
    		const folders = node.folders.filter(folderHasFiles);
    		const total = folders.length + node.files.length;
    		const watched = folders.filter(folder => folderIsFullyWatched(folder, watchState)).length + node.files.filter(file => watchState.get(file)).length;
    		const unwatched = folders.filter(folder => folderIsFullyUnwatched(folder, watchState)).length + node.files.filter(file => !watchState.get(file)).length;
    		const partial = total - watched - unwatched;
    		return { total, watched, partial, unwatched };
    	};

    	const func = cnode => starState.get(cnode);

    	const click_handler = () => {
    		$$invalidate(0, node = node.parent);
    	};

    	const click_handler_1 = cnode => {
    		$$invalidate(0, node = cnode);
    	};

    	const click_handler_2 = (cnode, watchedAll, each_value_2, cnode_index_1) => {
    		confirmSetAllWatched(cnode, watchedAll);
    		$$invalidate(0, each_value_2[cnode_index_1] = cnode, node);
    	};

    	const click_handler_3 = (cnode, each_value_2, cnode_index_1) => {
    		toggleStar(cnode);
    		$$invalidate(0, each_value_2[cnode_index_1] = cnode, node);
    	};

    	const click_handler_4 = (cnode, each_value, cnode_index) => {
    		openFile(cnode);
    		$$invalidate(0, each_value[cnode_index] = cnode, node);
    	};

    	const click_handler_5 = (cnode, each_value, cnode_index) => {
    		setWatched(cnode, !watchState.get(cnode));
    		$$invalidate(0, each_value[cnode_index] = cnode, node);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*node*/ 1) {
    			node && loadNode(node);
    		}
    	};

    	return [
    		node,
    		absPath,
    		watchState,
    		starState,
    		browse_button_click,
    		openFile,
    		setWatched,
    		toggleStar,
    		confirmSetAllWatched,
    		getFolderProgress,
    		func,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {}, null, [-1, -1]);
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

})();
