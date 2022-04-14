import '/node_modules/vite/dist/client/env.mjs';

const template = /*html*/ `
<style>
:host {
  position: fixed;
  z-index: 99999;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  margin: 0;
  background: rgba(0, 0, 0, 0.66);
  --monospace: 'SFMono-Regular', Consolas,
              'Liberation Mono', Menlo, Courier, monospace;
  --red: #ff5555;
  --yellow: #e2aa53;
  --purple: #cfa4ff;
  --cyan: #2dd9da;
  --dim: #c9c9c9;
}

.window {
  font-family: var(--monospace);
  line-height: 1.5;
  width: 800px;
  color: #d8d8d8;
  margin: 30px auto;
  padding: 25px 40px;
  position: relative;
  background: #181818;
  border-radius: 6px 6px 8px 8px;
  box-shadow: 0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22);
  overflow: hidden;
  border-top: 8px solid var(--red);
  direction: ltr;
  text-align: left;
}

pre {
  font-family: var(--monospace);
  font-size: 16px;
  margin-top: 0;
  margin-bottom: 1em;
  overflow-x: scroll;
  scrollbar-width: none;
}

pre::-webkit-scrollbar {
  display: none;
}

.message {
  line-height: 1.3;
  font-weight: 600;
  white-space: pre-wrap;
}

.message-body {
  color: var(--red);
}

.plugin {
  color: var(--purple);
}

.file {
  color: var(--cyan);
  margin-bottom: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.frame {
  color: var(--yellow);
}

.stack {
  font-size: 13px;
  color: var(--dim);
}

.tip {
  font-size: 13px;
  color: #999;
  border-top: 1px dotted #999;
  padding-top: 13px;
}

code {
  font-size: 13px;
  font-family: var(--monospace);
  color: var(--yellow);
}

.file-link {
  text-decoration: underline;
  cursor: pointer;
}
</style>
<div class="window">
  <pre class="message"><span class="plugin"></span><span class="message-body"></span></pre>
  <pre class="file"></pre>
  <pre class="frame"></pre>
  <pre class="stack"></pre>
  <div class="tip">
    Click outside or fix the code to dismiss.<br>
    You can also disable this overlay with
    <code>hmr: { overlay: false }</code> in <code>vite.config.js.</code>
  </div>
</div>
`;
const fileRE = /(?:[a-zA-Z]:\\|\/).*?:\d+:\d+/g;
const codeframeRE = /^(?:>?\s+\d+\s+\|.*|\s+\|\s*\^.*)\r?\n/gm;
class ErrorOverlay extends HTMLElement {
    constructor(err) {
        var _a;
        super();
        this.root = this.attachShadow({ mode: 'open' });
        this.root.innerHTML = template;
        codeframeRE.lastIndex = 0;
        const hasFrame = err.frame && codeframeRE.test(err.frame);
        const message = hasFrame
            ? err.message.replace(codeframeRE, '')
            : err.message;
        if (err.plugin) {
            this.text('.plugin', `[plugin:${err.plugin}] `);
        }
        this.text('.message-body', message.trim());
        const [file] = (((_a = err.loc) === null || _a === void 0 ? void 0 : _a.file) || err.id || 'unknown file').split(`?`);
        if (err.loc) {
            this.text('.file', `${file}:${err.loc.line}:${err.loc.column}`, true);
        }
        else if (err.id) {
            this.text('.file', file);
        }
        if (hasFrame) {
            this.text('.frame', err.frame.trim());
        }
        this.text('.stack', err.stack, true);
        this.root.querySelector('.window').addEventListener('click', (e) => {
            e.stopPropagation();
        });
        this.addEventListener('click', () => {
            this.close();
        });
    }
    text(selector, text, linkFiles = false) {
        const el = this.root.querySelector(selector);
        if (!linkFiles) {
            el.textContent = text;
        }
        else {
            let curIndex = 0;
            let match;
            while ((match = fileRE.exec(text))) {
                const { 0: file, index } = match;
                if (index != null) {
                    const frag = text.slice(curIndex, index);
                    el.appendChild(document.createTextNode(frag));
                    const link = document.createElement('a');
                    link.textContent = file;
                    link.className = 'file-link';
                    link.onclick = () => {
                        fetch('/__open-in-editor?file=' + encodeURIComponent(file));
                    };
                    el.appendChild(link);
                    curIndex += frag.length + file.length;
                }
            }
        }
    }
    close() {
        var _a;
        (_a = this.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(this);
    }
}
const overlayId = 'vite-error-overlay';
if (customElements && !customElements.get(overlayId)) {
    customElements.define(overlayId, ErrorOverlay);
}

console.log('[vite] connecting...');
// use server configuration, then fallback to inference
const socketProtocol = null || (location.protocol === 'https:' ? 'wss' : 'ws');
const socketHost = `${null || location.hostname}:${"443"}`;
const socket = new WebSocket(`${socketProtocol}://${socketHost}`, 'vite-hmr');
const base = "/" || '/';
function warnFailedFetch(err, path) {
    if (!err.message.match('fetch')) {
        console.error(err);
    }
    console.error(`[hmr] Failed to reload ${path}. ` +
        `This could be due to syntax errors or importing non-existent ` +
        `modules. (see errors above)`);
}
// Listen for messages
socket.addEventListener('message', async ({ data }) => {
    handleMessage(JSON.parse(data));
});
let isFirstUpdate = true;
async function handleMessage(payload) {
    switch (payload.type) {
        case 'connected':
            console.log(`[vite] connected.`);
            // proxy(nginx, docker) hmr ws maybe caused timeout,
            // so send ping package let ws keep alive.
            setInterval(() => socket.send('ping'), 30000);
            break;
        case 'update':
            notifyListeners('vite:beforeUpdate', payload);
            // if this is the first update and there's already an error overlay, it
            // means the page opened with existing server compile error and the whole
            // module script failed to load (since one of the nested imports is 500).
            // in this case a normal update won't work and a full reload is needed.
            if (isFirstUpdate && hasErrorOverlay()) {
                window.location.reload();
                return;
            }
            else {
                clearErrorOverlay();
                isFirstUpdate = false;
            }
            payload.updates.forEach((update) => {
                if (update.type === 'js-update') {
                    queueUpdate(fetchUpdate(update));
                }
                else {
                    // css-update
                    // this is only sent when a css file referenced with <link> is updated
                    let { path, timestamp } = update;
                    path = path.replace(/\?.*/, '');
                    // can't use querySelector with `[href*=]` here since the link may be
                    // using relative paths so we need to use link.href to grab the full
                    // URL for the include check.
                    const el = [].slice.call(document.querySelectorAll(`link`)).find((e) => e.href.includes(path));
                    if (el) {
                        const newPath = `${base}${path.slice(1)}${path.includes('?') ? '&' : '?'}t=${timestamp}`;
                        el.href = new URL(newPath, el.href).href;
                    }
                    console.log(`[vite] css hot updated: ${path}`);
                }
            });
            break;
        case 'custom': {
            notifyListeners(payload.event, payload.data);
            break;
        }
        case 'full-reload':
            notifyListeners('vite:beforeFullReload', payload);
            if (payload.path && payload.path.endsWith('.html')) {
                // if html file is edited, only reload the page if the browser is
                // currently on that page.
                const pagePath = location.pathname;
                const payloadPath = base + payload.path.slice(1);
                if (pagePath === payloadPath ||
                    (pagePath.endsWith('/') && pagePath + 'index.html' === payloadPath)) {
                    location.reload();
                }
                return;
            }
            else {
                location.reload();
            }
            break;
        case 'prune':
            notifyListeners('vite:beforePrune', payload);
            // After an HMR update, some modules are no longer imported on the page
            // but they may have left behind side effects that need to be cleaned up
            // (.e.g style injections)
            // TODO Trigger their dispose callbacks.
            payload.paths.forEach((path) => {
                const fn = pruneMap.get(path);
                if (fn) {
                    fn(dataMap.get(path));
                }
            });
            break;
        case 'error': {
            notifyListeners('vite:error', payload);
            const err = payload.err;
            if (enableOverlay) {
                createErrorOverlay(err);
            }
            else {
                console.error(`[vite] Internal Server Error\n${err.message}\n${err.stack}`);
            }
            break;
        }
        default: {
            const check = payload;
            return check;
        }
    }
}
function notifyListeners(event, data) {
    const cbs = customListenersMap.get(event);
    if (cbs) {
        cbs.forEach((cb) => cb(data));
    }
}
const enableOverlay = false;
function createErrorOverlay(err) {
    if (!enableOverlay)
        return;
    clearErrorOverlay();
    document.body.appendChild(new ErrorOverlay(err));
}
function clearErrorOverlay() {
    document
        .querySelectorAll(overlayId)
        .forEach((n) => n.close());
}
function hasErrorOverlay() {
    return document.querySelectorAll(overlayId).length;
}
let pending = false;
let queued = [];
/**
 * buffer multiple hot updates triggered by the same src change
 * so that they are invoked in the same order they were sent.
 * (otherwise the order may be inconsistent because of the http request round trip)
 */
async function queueUpdate(p) {
    queued.push(p);
    if (!pending) {
        pending = true;
        await Promise.resolve();
        pending = false;
        const loading = [...queued];
        queued = [];
        (await Promise.all(loading)).forEach((fn) => fn && fn());
    }
}
async function waitForSuccessfulPing(ms = 1000) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            await fetch(`${base}__vite_ping`);
            break;
        }
        catch (e) {
            await new Promise((resolve) => setTimeout(resolve, ms));
        }
    }
}
// ping server
socket.addEventListener('close', async ({ wasClean }) => {
    if (wasClean)
        return;
    console.log(`[vite] server connection lost. polling for restart...`);
    await waitForSuccessfulPing();
    location.reload();
});
const sheetsMap = new Map();
function updateStyle(id, content) {
    let style = sheetsMap.get(id);
    {
        if (style && !(style instanceof HTMLStyleElement)) {
            removeStyle(id);
            style = undefined;
        }
        if (!style) {
            style = document.createElement('style');
            style.setAttribute('type', 'text/css');
            style.innerHTML = content;
            document.head.appendChild(style);
        }
        else {
            style.innerHTML = content;
        }
    }
    sheetsMap.set(id, style);
}
function removeStyle(id) {
    const style = sheetsMap.get(id);
    if (style) {
        if (style instanceof CSSStyleSheet) {
            // @ts-ignore
            document.adoptedStyleSheets.indexOf(style);
            // @ts-ignore
            document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== style);
        }
        else {
            document.head.removeChild(style);
        }
        sheetsMap.delete(id);
    }
}
async function fetchUpdate({ path, acceptedPath, timestamp }) {
    const mod = hotModulesMap.get(path);
    if (!mod) {
        // In a code-splitting project,
        // it is common that the hot-updating module is not loaded yet.
        // https://github.com/vitejs/vite/issues/721
        return;
    }
    const moduleMap = new Map();
    const isSelfUpdate = path === acceptedPath;
    // make sure we only import each dep once
    const modulesToUpdate = new Set();
    if (isSelfUpdate) {
        // self update - only update self
        modulesToUpdate.add(path);
    }
    else {
        // dep update
        for (const { deps } of mod.callbacks) {
            deps.forEach((dep) => {
                if (acceptedPath === dep) {
                    modulesToUpdate.add(dep);
                }
            });
        }
    }
    // determine the qualified callbacks before we re-import the modules
    const qualifiedCallbacks = mod.callbacks.filter(({ deps }) => {
        return deps.some((dep) => modulesToUpdate.has(dep));
    });
    await Promise.all(Array.from(modulesToUpdate).map(async (dep) => {
        const disposer = disposeMap.get(dep);
        if (disposer)
            await disposer(dataMap.get(dep));
        const [path, query] = dep.split(`?`);
        try {
            const newMod = await import(
            /* @vite-ignore */
            base +
                path.slice(1) +
                `?import&t=${timestamp}${query ? `&${query}` : ''}`);
            moduleMap.set(dep, newMod);
        }
        catch (e) {
            warnFailedFetch(e, dep);
        }
    }));
    return () => {
        for (const { deps, fn } of qualifiedCallbacks) {
            fn(deps.map((dep) => moduleMap.get(dep)));
        }
        const loggedPath = isSelfUpdate ? path : `${acceptedPath} via ${path}`;
        console.log(`[vite] hot updated: ${loggedPath}`);
    };
}
const hotModulesMap = new Map();
const disposeMap = new Map();
const pruneMap = new Map();
const dataMap = new Map();
const customListenersMap = new Map();
const ctxToListenersMap = new Map();
// Just infer the return type for now
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const createHotContext = (ownerPath) => {
    if (!dataMap.has(ownerPath)) {
        dataMap.set(ownerPath, {});
    }
    // when a file is hot updated, a new context is created
    // clear its stale callbacks
    const mod = hotModulesMap.get(ownerPath);
    if (mod) {
        mod.callbacks = [];
    }
    // clear stale custom event listeners
    const staleListeners = ctxToListenersMap.get(ownerPath);
    if (staleListeners) {
        for (const [event, staleFns] of staleListeners) {
            const listeners = customListenersMap.get(event);
            if (listeners) {
                customListenersMap.set(event, listeners.filter((l) => !staleFns.includes(l)));
            }
        }
    }
    const newListeners = new Map();
    ctxToListenersMap.set(ownerPath, newListeners);
    function acceptDeps(deps, callback = () => { }) {
        const mod = hotModulesMap.get(ownerPath) || {
            id: ownerPath,
            callbacks: []
        };
        mod.callbacks.push({
            deps,
            fn: callback
        });
        hotModulesMap.set(ownerPath, mod);
    }
    const hot = {
        get data() {
            return dataMap.get(ownerPath);
        },
        accept(deps, callback) {
            if (typeof deps === 'function' || !deps) {
                // self-accept: hot.accept(() => {})
                acceptDeps([ownerPath], ([mod]) => deps && deps(mod));
            }
            else if (typeof deps === 'string') {
                // explicit deps
                acceptDeps([deps], ([mod]) => callback && callback(mod));
            }
            else if (Array.isArray(deps)) {
                acceptDeps(deps, callback);
            }
            else {
                throw new Error(`invalid hot.accept() usage.`);
            }
        },
        acceptDeps() {
            throw new Error(`hot.acceptDeps() is deprecated. ` +
                `Use hot.accept() with the same signature instead.`);
        },
        dispose(cb) {
            disposeMap.set(ownerPath, cb);
        },
        prune(cb) {
            pruneMap.set(ownerPath, cb);
        },
        // TODO
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        decline() { },
        invalidate() {
            // TODO should tell the server to re-perform hmr propagation
            // from this module as root
            location.reload();
        },
        // custom events
        on: (event, cb) => {
            const addToMap = (map) => {
                const existing = map.get(event) || [];
                existing.push(cb);
                map.set(event, existing);
            };
            addToMap(customListenersMap);
            addToMap(newListeners);
        }
    };
    return hot;
};
/**
 * urls here are dynamic import() urls that couldn't be statically analyzed
 */
function injectQuery(url, queryToInject) {
    // skip urls that won't be handled by vite
    if (!url.startsWith('.') && !url.startsWith('/')) {
        return url;
    }
    // can't use pathname from URL since it may be relative like ../
    const pathname = url.replace(/#.*$/, '').replace(/\?.*$/, '');
    const { search, hash } = new URL(url, 'http://vitejs.dev');
    return `${pathname}?${queryToInject}${search ? `&` + search.slice(1) : ''}${hash || ''}`;
}

export { createHotContext, injectQuery, removeStyle, updateStyle };
//# sourceMappingURL=client.mjs.map

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpZW50Lm1qcyIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NsaWVudC9vdmVybGF5LnRzIiwiLi4vLi4vc3JjL2NsaWVudC9jbGllbnQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXJyb3JQYXlsb2FkIH0gZnJvbSAndHlwZXMvaG1yUGF5bG9hZCdcblxuY29uc3QgdGVtcGxhdGUgPSAvKmh0bWwqLyBgXG48c3R5bGU+XG46aG9zdCB7XG4gIHBvc2l0aW9uOiBmaXhlZDtcbiAgei1pbmRleDogOTk5OTk7XG4gIHRvcDogMDtcbiAgbGVmdDogMDtcbiAgd2lkdGg6IDEwMCU7XG4gIGhlaWdodDogMTAwJTtcbiAgb3ZlcmZsb3cteTogc2Nyb2xsO1xuICBtYXJnaW46IDA7XG4gIGJhY2tncm91bmQ6IHJnYmEoMCwgMCwgMCwgMC42Nik7XG4gIC0tbW9ub3NwYWNlOiAnU0ZNb25vLVJlZ3VsYXInLCBDb25zb2xhcyxcbiAgICAgICAgICAgICAgJ0xpYmVyYXRpb24gTW9ubycsIE1lbmxvLCBDb3VyaWVyLCBtb25vc3BhY2U7XG4gIC0tcmVkOiAjZmY1NTU1O1xuICAtLXllbGxvdzogI2UyYWE1MztcbiAgLS1wdXJwbGU6ICNjZmE0ZmY7XG4gIC0tY3lhbjogIzJkZDlkYTtcbiAgLS1kaW06ICNjOWM5Yzk7XG59XG5cbi53aW5kb3cge1xuICBmb250LWZhbWlseTogdmFyKC0tbW9ub3NwYWNlKTtcbiAgbGluZS1oZWlnaHQ6IDEuNTtcbiAgd2lkdGg6IDgwMHB4O1xuICBjb2xvcjogI2Q4ZDhkODtcbiAgbWFyZ2luOiAzMHB4IGF1dG87XG4gIHBhZGRpbmc6IDI1cHggNDBweDtcbiAgcG9zaXRpb246IHJlbGF0aXZlO1xuICBiYWNrZ3JvdW5kOiAjMTgxODE4O1xuICBib3JkZXItcmFkaXVzOiA2cHggNnB4IDhweCA4cHg7XG4gIGJveC1zaGFkb3c6IDAgMTlweCAzOHB4IHJnYmEoMCwwLDAsMC4zMCksIDAgMTVweCAxMnB4IHJnYmEoMCwwLDAsMC4yMik7XG4gIG92ZXJmbG93OiBoaWRkZW47XG4gIGJvcmRlci10b3A6IDhweCBzb2xpZCB2YXIoLS1yZWQpO1xuICBkaXJlY3Rpb246IGx0cjtcbiAgdGV4dC1hbGlnbjogbGVmdDtcbn1cblxucHJlIHtcbiAgZm9udC1mYW1pbHk6IHZhcigtLW1vbm9zcGFjZSk7XG4gIGZvbnQtc2l6ZTogMTZweDtcbiAgbWFyZ2luLXRvcDogMDtcbiAgbWFyZ2luLWJvdHRvbTogMWVtO1xuICBvdmVyZmxvdy14OiBzY3JvbGw7XG4gIHNjcm9sbGJhci13aWR0aDogbm9uZTtcbn1cblxucHJlOjotd2Via2l0LXNjcm9sbGJhciB7XG4gIGRpc3BsYXk6IG5vbmU7XG59XG5cbi5tZXNzYWdlIHtcbiAgbGluZS1oZWlnaHQ6IDEuMztcbiAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xufVxuXG4ubWVzc2FnZS1ib2R5IHtcbiAgY29sb3I6IHZhcigtLXJlZCk7XG59XG5cbi5wbHVnaW4ge1xuICBjb2xvcjogdmFyKC0tcHVycGxlKTtcbn1cblxuLmZpbGUge1xuICBjb2xvcjogdmFyKC0tY3lhbik7XG4gIG1hcmdpbi1ib3R0b206IDA7XG4gIHdoaXRlLXNwYWNlOiBwcmUtd3JhcDtcbiAgd29yZC1icmVhazogYnJlYWstYWxsO1xufVxuXG4uZnJhbWUge1xuICBjb2xvcjogdmFyKC0teWVsbG93KTtcbn1cblxuLnN0YWNrIHtcbiAgZm9udC1zaXplOiAxM3B4O1xuICBjb2xvcjogdmFyKC0tZGltKTtcbn1cblxuLnRpcCB7XG4gIGZvbnQtc2l6ZTogMTNweDtcbiAgY29sb3I6ICM5OTk7XG4gIGJvcmRlci10b3A6IDFweCBkb3R0ZWQgIzk5OTtcbiAgcGFkZGluZy10b3A6IDEzcHg7XG59XG5cbmNvZGUge1xuICBmb250LXNpemU6IDEzcHg7XG4gIGZvbnQtZmFtaWx5OiB2YXIoLS1tb25vc3BhY2UpO1xuICBjb2xvcjogdmFyKC0teWVsbG93KTtcbn1cblxuLmZpbGUtbGluayB7XG4gIHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lO1xuICBjdXJzb3I6IHBvaW50ZXI7XG59XG48L3N0eWxlPlxuPGRpdiBjbGFzcz1cIndpbmRvd1wiPlxuICA8cHJlIGNsYXNzPVwibWVzc2FnZVwiPjxzcGFuIGNsYXNzPVwicGx1Z2luXCI+PC9zcGFuPjxzcGFuIGNsYXNzPVwibWVzc2FnZS1ib2R5XCI+PC9zcGFuPjwvcHJlPlxuICA8cHJlIGNsYXNzPVwiZmlsZVwiPjwvcHJlPlxuICA8cHJlIGNsYXNzPVwiZnJhbWVcIj48L3ByZT5cbiAgPHByZSBjbGFzcz1cInN0YWNrXCI+PC9wcmU+XG4gIDxkaXYgY2xhc3M9XCJ0aXBcIj5cbiAgICBDbGljayBvdXRzaWRlIG9yIGZpeCB0aGUgY29kZSB0byBkaXNtaXNzLjxicj5cbiAgICBZb3UgY2FuIGFsc28gZGlzYWJsZSB0aGlzIG92ZXJsYXkgd2l0aFxuICAgIDxjb2RlPmhtcjogeyBvdmVybGF5OiBmYWxzZSB9PC9jb2RlPiBpbiA8Y29kZT52aXRlLmNvbmZpZy5qcy48L2NvZGU+XG4gIDwvZGl2PlxuPC9kaXY+XG5gXG5cbmNvbnN0IGZpbGVSRSA9IC8oPzpbYS16QS1aXTpcXFxcfFxcLykuKj86XFxkKzpcXGQrL2dcbmNvbnN0IGNvZGVmcmFtZVJFID0gL14oPzo+P1xccytcXGQrXFxzK1xcfC4qfFxccytcXHxcXHMqXFxeLiopXFxyP1xcbi9nbVxuXG5leHBvcnQgY2xhc3MgRXJyb3JPdmVybGF5IGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuICByb290OiBTaGFkb3dSb290XG5cbiAgY29uc3RydWN0b3IoZXJyOiBFcnJvclBheWxvYWRbJ2VyciddKSB7XG4gICAgc3VwZXIoKVxuICAgIHRoaXMucm9vdCA9IHRoaXMuYXR0YWNoU2hhZG93KHsgbW9kZTogJ29wZW4nIH0pXG4gICAgdGhpcy5yb290LmlubmVySFRNTCA9IHRlbXBsYXRlXG5cbiAgICBjb2RlZnJhbWVSRS5sYXN0SW5kZXggPSAwXG4gICAgY29uc3QgaGFzRnJhbWUgPSBlcnIuZnJhbWUgJiYgY29kZWZyYW1lUkUudGVzdChlcnIuZnJhbWUpXG4gICAgY29uc3QgbWVzc2FnZSA9IGhhc0ZyYW1lXG4gICAgICA/IGVyci5tZXNzYWdlLnJlcGxhY2UoY29kZWZyYW1lUkUsICcnKVxuICAgICAgOiBlcnIubWVzc2FnZVxuICAgIGlmIChlcnIucGx1Z2luKSB7XG4gICAgICB0aGlzLnRleHQoJy5wbHVnaW4nLCBgW3BsdWdpbjoke2Vyci5wbHVnaW59XSBgKVxuICAgIH1cbiAgICB0aGlzLnRleHQoJy5tZXNzYWdlLWJvZHknLCBtZXNzYWdlLnRyaW0oKSlcblxuICAgIGNvbnN0IFtmaWxlXSA9IChlcnIubG9jPy5maWxlIHx8IGVyci5pZCB8fCAndW5rbm93biBmaWxlJykuc3BsaXQoYD9gKVxuICAgIGlmIChlcnIubG9jKSB7XG4gICAgICB0aGlzLnRleHQoJy5maWxlJywgYCR7ZmlsZX06JHtlcnIubG9jLmxpbmV9OiR7ZXJyLmxvYy5jb2x1bW59YCwgdHJ1ZSlcbiAgICB9IGVsc2UgaWYgKGVyci5pZCkge1xuICAgICAgdGhpcy50ZXh0KCcuZmlsZScsIGZpbGUpXG4gICAgfVxuXG4gICAgaWYgKGhhc0ZyYW1lKSB7XG4gICAgICB0aGlzLnRleHQoJy5mcmFtZScsIGVyci5mcmFtZSEudHJpbSgpKVxuICAgIH1cbiAgICB0aGlzLnRleHQoJy5zdGFjaycsIGVyci5zdGFjaywgdHJ1ZSlcblxuICAgIHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKCcud2luZG93JykhLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICB9KVxuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICB0aGlzLmNsb3NlKClcbiAgICB9KVxuICB9XG5cbiAgdGV4dChzZWxlY3Rvcjogc3RyaW5nLCB0ZXh0OiBzdHJpbmcsIGxpbmtGaWxlcyA9IGZhbHNlKTogdm9pZCB7XG4gICAgY29uc3QgZWwgPSB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihzZWxlY3RvcikhXG4gICAgaWYgKCFsaW5rRmlsZXMpIHtcbiAgICAgIGVsLnRleHRDb250ZW50ID0gdGV4dFxuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgY3VySW5kZXggPSAwXG4gICAgICBsZXQgbWF0Y2g6IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGxcbiAgICAgIHdoaWxlICgobWF0Y2ggPSBmaWxlUkUuZXhlYyh0ZXh0KSkpIHtcbiAgICAgICAgY29uc3QgeyAwOiBmaWxlLCBpbmRleCB9ID0gbWF0Y2hcbiAgICAgICAgaWYgKGluZGV4ICE9IG51bGwpIHtcbiAgICAgICAgICBjb25zdCBmcmFnID0gdGV4dC5zbGljZShjdXJJbmRleCwgaW5kZXgpXG4gICAgICAgICAgZWwuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoZnJhZykpXG4gICAgICAgICAgY29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKVxuICAgICAgICAgIGxpbmsudGV4dENvbnRlbnQgPSBmaWxlXG4gICAgICAgICAgbGluay5jbGFzc05hbWUgPSAnZmlsZS1saW5rJ1xuICAgICAgICAgIGxpbmsub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgIGZldGNoKCcvX19vcGVuLWluLWVkaXRvcj9maWxlPScgKyBlbmNvZGVVUklDb21wb25lbnQoZmlsZSkpXG4gICAgICAgICAgfVxuICAgICAgICAgIGVsLmFwcGVuZENoaWxkKGxpbmspXG4gICAgICAgICAgY3VySW5kZXggKz0gZnJhZy5sZW5ndGggKyBmaWxlLmxlbmd0aFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY2xvc2UoKTogdm9pZCB7XG4gICAgdGhpcy5wYXJlbnROb2RlPy5yZW1vdmVDaGlsZCh0aGlzKVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBvdmVybGF5SWQgPSAndml0ZS1lcnJvci1vdmVybGF5J1xuaWYgKGN1c3RvbUVsZW1lbnRzICYmICFjdXN0b21FbGVtZW50cy5nZXQob3ZlcmxheUlkKSkge1xuICBjdXN0b21FbGVtZW50cy5kZWZpbmUob3ZlcmxheUlkLCBFcnJvck92ZXJsYXkpXG59XG4iLCJpbXBvcnQge1xuICBFcnJvclBheWxvYWQsXG4gIEZ1bGxSZWxvYWRQYXlsb2FkLFxuICBITVJQYXlsb2FkLFxuICBQcnVuZVBheWxvYWQsXG4gIFVwZGF0ZSxcbiAgVXBkYXRlUGF5bG9hZFxufSBmcm9tICd0eXBlcy9obXJQYXlsb2FkJ1xuaW1wb3J0IHsgQ3VzdG9tRXZlbnROYW1lIH0gZnJvbSAndHlwZXMvY3VzdG9tRXZlbnQnXG5pbXBvcnQgeyBFcnJvck92ZXJsYXksIG92ZXJsYXlJZCB9IGZyb20gJy4vb3ZlcmxheSdcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBub2RlL25vLW1pc3NpbmctaW1wb3J0XG5pbXBvcnQgJ0B2aXRlL2VudidcblxuLy8gaW5qZWN0ZWQgYnkgdGhlIGhtciBwbHVnaW4gd2hlbiBzZXJ2ZWRcbmRlY2xhcmUgY29uc3QgX19CQVNFX186IHN0cmluZ1xuZGVjbGFyZSBjb25zdCBfX0hNUl9QUk9UT0NPTF9fOiBzdHJpbmdcbmRlY2xhcmUgY29uc3QgX19ITVJfSE9TVE5BTUVfXzogc3RyaW5nXG5kZWNsYXJlIGNvbnN0IF9fSE1SX1BPUlRfXzogc3RyaW5nXG5kZWNsYXJlIGNvbnN0IF9fSE1SX1RJTUVPVVRfXzogbnVtYmVyXG5kZWNsYXJlIGNvbnN0IF9fSE1SX0VOQUJMRV9PVkVSTEFZX186IGJvb2xlYW5cblxuY29uc29sZS5sb2coJ1t2aXRlXSBjb25uZWN0aW5nLi4uJylcblxuLy8gdXNlIHNlcnZlciBjb25maWd1cmF0aW9uLCB0aGVuIGZhbGxiYWNrIHRvIGluZmVyZW5jZVxuY29uc3Qgc29ja2V0UHJvdG9jb2wgPVxuICBfX0hNUl9QUk9UT0NPTF9fIHx8IChsb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOicgPyAnd3NzJyA6ICd3cycpXG5jb25zdCBzb2NrZXRIb3N0ID0gYCR7X19ITVJfSE9TVE5BTUVfXyB8fCBsb2NhdGlvbi5ob3N0bmFtZX06JHtfX0hNUl9QT1JUX199YFxuY29uc3Qgc29ja2V0ID0gbmV3IFdlYlNvY2tldChgJHtzb2NrZXRQcm90b2NvbH06Ly8ke3NvY2tldEhvc3R9YCwgJ3ZpdGUtaG1yJylcbmNvbnN0IGJhc2UgPSBfX0JBU0VfXyB8fCAnLydcblxuZnVuY3Rpb24gd2FybkZhaWxlZEZldGNoKGVycjogRXJyb3IsIHBhdGg6IHN0cmluZyB8IHN0cmluZ1tdKSB7XG4gIGlmICghZXJyLm1lc3NhZ2UubWF0Y2goJ2ZldGNoJykpIHtcbiAgICBjb25zb2xlLmVycm9yKGVycilcbiAgfVxuICBjb25zb2xlLmVycm9yKFxuICAgIGBbaG1yXSBGYWlsZWQgdG8gcmVsb2FkICR7cGF0aH0uIGAgK1xuICAgICAgYFRoaXMgY291bGQgYmUgZHVlIHRvIHN5bnRheCBlcnJvcnMgb3IgaW1wb3J0aW5nIG5vbi1leGlzdGVudCBgICtcbiAgICAgIGBtb2R1bGVzLiAoc2VlIGVycm9ycyBhYm92ZSlgXG4gIClcbn1cblxuLy8gTGlzdGVuIGZvciBtZXNzYWdlc1xuc29ja2V0LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBhc3luYyAoeyBkYXRhIH0pID0+IHtcbiAgaGFuZGxlTWVzc2FnZShKU09OLnBhcnNlKGRhdGEpKVxufSlcblxubGV0IGlzRmlyc3RVcGRhdGUgPSB0cnVlXG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZU1lc3NhZ2UocGF5bG9hZDogSE1SUGF5bG9hZCkge1xuICBzd2l0Y2ggKHBheWxvYWQudHlwZSkge1xuICAgIGNhc2UgJ2Nvbm5lY3RlZCc6XG4gICAgICBjb25zb2xlLmxvZyhgW3ZpdGVdIGNvbm5lY3RlZC5gKVxuICAgICAgLy8gcHJveHkobmdpbngsIGRvY2tlcikgaG1yIHdzIG1heWJlIGNhdXNlZCB0aW1lb3V0LFxuICAgICAgLy8gc28gc2VuZCBwaW5nIHBhY2thZ2UgbGV0IHdzIGtlZXAgYWxpdmUuXG4gICAgICBzZXRJbnRlcnZhbCgoKSA9PiBzb2NrZXQuc2VuZCgncGluZycpLCBfX0hNUl9USU1FT1VUX18pXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VwZGF0ZSc6XG4gICAgICBub3RpZnlMaXN0ZW5lcnMoJ3ZpdGU6YmVmb3JlVXBkYXRlJywgcGF5bG9hZClcbiAgICAgIC8vIGlmIHRoaXMgaXMgdGhlIGZpcnN0IHVwZGF0ZSBhbmQgdGhlcmUncyBhbHJlYWR5IGFuIGVycm9yIG92ZXJsYXksIGl0XG4gICAgICAvLyBtZWFucyB0aGUgcGFnZSBvcGVuZWQgd2l0aCBleGlzdGluZyBzZXJ2ZXIgY29tcGlsZSBlcnJvciBhbmQgdGhlIHdob2xlXG4gICAgICAvLyBtb2R1bGUgc2NyaXB0IGZhaWxlZCB0byBsb2FkIChzaW5jZSBvbmUgb2YgdGhlIG5lc3RlZCBpbXBvcnRzIGlzIDUwMCkuXG4gICAgICAvLyBpbiB0aGlzIGNhc2UgYSBub3JtYWwgdXBkYXRlIHdvbid0IHdvcmsgYW5kIGEgZnVsbCByZWxvYWQgaXMgbmVlZGVkLlxuICAgICAgaWYgKGlzRmlyc3RVcGRhdGUgJiYgaGFzRXJyb3JPdmVybGF5KCkpIHtcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpXG4gICAgICAgIHJldHVyblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2xlYXJFcnJvck92ZXJsYXkoKVxuICAgICAgICBpc0ZpcnN0VXBkYXRlID0gZmFsc2VcbiAgICAgIH1cbiAgICAgIHBheWxvYWQudXBkYXRlcy5mb3JFYWNoKCh1cGRhdGUpID0+IHtcbiAgICAgICAgaWYgKHVwZGF0ZS50eXBlID09PSAnanMtdXBkYXRlJykge1xuICAgICAgICAgIHF1ZXVlVXBkYXRlKGZldGNoVXBkYXRlKHVwZGF0ZSkpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gY3NzLXVwZGF0ZVxuICAgICAgICAgIC8vIHRoaXMgaXMgb25seSBzZW50IHdoZW4gYSBjc3MgZmlsZSByZWZlcmVuY2VkIHdpdGggPGxpbms+IGlzIHVwZGF0ZWRcbiAgICAgICAgICBsZXQgeyBwYXRoLCB0aW1lc3RhbXAgfSA9IHVwZGF0ZVxuICAgICAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoL1xcPy4qLywgJycpXG4gICAgICAgICAgLy8gY2FuJ3QgdXNlIHF1ZXJ5U2VsZWN0b3Igd2l0aCBgW2hyZWYqPV1gIGhlcmUgc2luY2UgdGhlIGxpbmsgbWF5IGJlXG4gICAgICAgICAgLy8gdXNpbmcgcmVsYXRpdmUgcGF0aHMgc28gd2UgbmVlZCB0byB1c2UgbGluay5ocmVmIHRvIGdyYWIgdGhlIGZ1bGxcbiAgICAgICAgICAvLyBVUkwgZm9yIHRoZSBpbmNsdWRlIGNoZWNrLlxuICAgICAgICAgIGNvbnN0IGVsID0gKFxuICAgICAgICAgICAgW10uc2xpY2UuY2FsbChcbiAgICAgICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChgbGlua2ApXG4gICAgICAgICAgICApIGFzIEhUTUxMaW5rRWxlbWVudFtdXG4gICAgICAgICAgKS5maW5kKChlKSA9PiBlLmhyZWYuaW5jbHVkZXMocGF0aCkpXG4gICAgICAgICAgaWYgKGVsKSB7XG4gICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gYCR7YmFzZX0ke3BhdGguc2xpY2UoMSl9JHtcbiAgICAgICAgICAgICAgcGF0aC5pbmNsdWRlcygnPycpID8gJyYnIDogJz8nXG4gICAgICAgICAgICB9dD0ke3RpbWVzdGFtcH1gXG4gICAgICAgICAgICBlbC5ocmVmID0gbmV3IFVSTChuZXdQYXRoLCBlbC5ocmVmKS5ocmVmXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbdml0ZV0gY3NzIGhvdCB1cGRhdGVkOiAke3BhdGh9YClcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnY3VzdG9tJzoge1xuICAgICAgbm90aWZ5TGlzdGVuZXJzKHBheWxvYWQuZXZlbnQgYXMgQ3VzdG9tRXZlbnROYW1lPGFueT4sIHBheWxvYWQuZGF0YSlcbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIGNhc2UgJ2Z1bGwtcmVsb2FkJzpcbiAgICAgIG5vdGlmeUxpc3RlbmVycygndml0ZTpiZWZvcmVGdWxsUmVsb2FkJywgcGF5bG9hZClcbiAgICAgIGlmIChwYXlsb2FkLnBhdGggJiYgcGF5bG9hZC5wYXRoLmVuZHNXaXRoKCcuaHRtbCcpKSB7XG4gICAgICAgIC8vIGlmIGh0bWwgZmlsZSBpcyBlZGl0ZWQsIG9ubHkgcmVsb2FkIHRoZSBwYWdlIGlmIHRoZSBicm93c2VyIGlzXG4gICAgICAgIC8vIGN1cnJlbnRseSBvbiB0aGF0IHBhZ2UuXG4gICAgICAgIGNvbnN0IHBhZ2VQYXRoID0gbG9jYXRpb24ucGF0aG5hbWVcbiAgICAgICAgY29uc3QgcGF5bG9hZFBhdGggPSBiYXNlICsgcGF5bG9hZC5wYXRoLnNsaWNlKDEpXG4gICAgICAgIGlmIChcbiAgICAgICAgICBwYWdlUGF0aCA9PT0gcGF5bG9hZFBhdGggfHxcbiAgICAgICAgICAocGFnZVBhdGguZW5kc1dpdGgoJy8nKSAmJiBwYWdlUGF0aCArICdpbmRleC5odG1sJyA9PT0gcGF5bG9hZFBhdGgpXG4gICAgICAgICkge1xuICAgICAgICAgIGxvY2F0aW9uLnJlbG9hZCgpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2NhdGlvbi5yZWxvYWQoKVxuICAgICAgfVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdwcnVuZSc6XG4gICAgICBub3RpZnlMaXN0ZW5lcnMoJ3ZpdGU6YmVmb3JlUHJ1bmUnLCBwYXlsb2FkKVxuICAgICAgLy8gQWZ0ZXIgYW4gSE1SIHVwZGF0ZSwgc29tZSBtb2R1bGVzIGFyZSBubyBsb25nZXIgaW1wb3J0ZWQgb24gdGhlIHBhZ2VcbiAgICAgIC8vIGJ1dCB0aGV5IG1heSBoYXZlIGxlZnQgYmVoaW5kIHNpZGUgZWZmZWN0cyB0aGF0IG5lZWQgdG8gYmUgY2xlYW5lZCB1cFxuICAgICAgLy8gKC5lLmcgc3R5bGUgaW5qZWN0aW9ucylcbiAgICAgIC8vIFRPRE8gVHJpZ2dlciB0aGVpciBkaXNwb3NlIGNhbGxiYWNrcy5cbiAgICAgIHBheWxvYWQucGF0aHMuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgICBjb25zdCBmbiA9IHBydW5lTWFwLmdldChwYXRoKVxuICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICBmbihkYXRhTWFwLmdldChwYXRoKSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnZXJyb3InOiB7XG4gICAgICBub3RpZnlMaXN0ZW5lcnMoJ3ZpdGU6ZXJyb3InLCBwYXlsb2FkKVxuICAgICAgY29uc3QgZXJyID0gcGF5bG9hZC5lcnJcbiAgICAgIGlmIChlbmFibGVPdmVybGF5KSB7XG4gICAgICAgIGNyZWF0ZUVycm9yT3ZlcmxheShlcnIpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIGBbdml0ZV0gSW50ZXJuYWwgU2VydmVyIEVycm9yXFxuJHtlcnIubWVzc2FnZX1cXG4ke2Vyci5zdGFja31gXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIGRlZmF1bHQ6IHtcbiAgICAgIGNvbnN0IGNoZWNrOiBuZXZlciA9IHBheWxvYWRcbiAgICAgIHJldHVybiBjaGVja1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBub3RpZnlMaXN0ZW5lcnMoXG4gIGV2ZW50OiAndml0ZTpiZWZvcmVVcGRhdGUnLFxuICBwYXlsb2FkOiBVcGRhdGVQYXlsb2FkXG4pOiB2b2lkXG5mdW5jdGlvbiBub3RpZnlMaXN0ZW5lcnMoZXZlbnQ6ICd2aXRlOmJlZm9yZVBydW5lJywgcGF5bG9hZDogUHJ1bmVQYXlsb2FkKTogdm9pZFxuZnVuY3Rpb24gbm90aWZ5TGlzdGVuZXJzKFxuICBldmVudDogJ3ZpdGU6YmVmb3JlRnVsbFJlbG9hZCcsXG4gIHBheWxvYWQ6IEZ1bGxSZWxvYWRQYXlsb2FkXG4pOiB2b2lkXG5mdW5jdGlvbiBub3RpZnlMaXN0ZW5lcnMoZXZlbnQ6ICd2aXRlOmVycm9yJywgcGF5bG9hZDogRXJyb3JQYXlsb2FkKTogdm9pZFxuZnVuY3Rpb24gbm90aWZ5TGlzdGVuZXJzPFQgZXh0ZW5kcyBzdHJpbmc+KFxuICBldmVudDogQ3VzdG9tRXZlbnROYW1lPFQ+LFxuICBkYXRhOiBhbnlcbik6IHZvaWRcbmZ1bmN0aW9uIG5vdGlmeUxpc3RlbmVycyhldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpOiB2b2lkIHtcbiAgY29uc3QgY2JzID0gY3VzdG9tTGlzdGVuZXJzTWFwLmdldChldmVudClcbiAgaWYgKGNicykge1xuICAgIGNicy5mb3JFYWNoKChjYikgPT4gY2IoZGF0YSkpXG4gIH1cbn1cblxuY29uc3QgZW5hYmxlT3ZlcmxheSA9IF9fSE1SX0VOQUJMRV9PVkVSTEFZX19cblxuZnVuY3Rpb24gY3JlYXRlRXJyb3JPdmVybGF5KGVycjogRXJyb3JQYXlsb2FkWydlcnInXSkge1xuICBpZiAoIWVuYWJsZU92ZXJsYXkpIHJldHVyblxuICBjbGVhckVycm9yT3ZlcmxheSgpXG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobmV3IEVycm9yT3ZlcmxheShlcnIpKVxufVxuXG5mdW5jdGlvbiBjbGVhckVycm9yT3ZlcmxheSgpIHtcbiAgZG9jdW1lbnRcbiAgICAucXVlcnlTZWxlY3RvckFsbChvdmVybGF5SWQpXG4gICAgLmZvckVhY2goKG4pID0+IChuIGFzIEVycm9yT3ZlcmxheSkuY2xvc2UoKSlcbn1cblxuZnVuY3Rpb24gaGFzRXJyb3JPdmVybGF5KCkge1xuICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChvdmVybGF5SWQpLmxlbmd0aFxufVxuXG5sZXQgcGVuZGluZyA9IGZhbHNlXG5sZXQgcXVldWVkOiBQcm9taXNlPCgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZD5bXSA9IFtdXG5cbi8qKlxuICogYnVmZmVyIG11bHRpcGxlIGhvdCB1cGRhdGVzIHRyaWdnZXJlZCBieSB0aGUgc2FtZSBzcmMgY2hhbmdlXG4gKiBzbyB0aGF0IHRoZXkgYXJlIGludm9rZWQgaW4gdGhlIHNhbWUgb3JkZXIgdGhleSB3ZXJlIHNlbnQuXG4gKiAob3RoZXJ3aXNlIHRoZSBvcmRlciBtYXkgYmUgaW5jb25zaXN0ZW50IGJlY2F1c2Ugb2YgdGhlIGh0dHAgcmVxdWVzdCByb3VuZCB0cmlwKVxuICovXG5hc3luYyBmdW5jdGlvbiBxdWV1ZVVwZGF0ZShwOiBQcm9taXNlPCgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZD4pIHtcbiAgcXVldWVkLnB1c2gocClcbiAgaWYgKCFwZW5kaW5nKSB7XG4gICAgcGVuZGluZyA9IHRydWVcbiAgICBhd2FpdCBQcm9taXNlLnJlc29sdmUoKVxuICAgIHBlbmRpbmcgPSBmYWxzZVxuICAgIGNvbnN0IGxvYWRpbmcgPSBbLi4ucXVldWVkXVxuICAgIHF1ZXVlZCA9IFtdXG4gICAgOyhhd2FpdCBQcm9taXNlLmFsbChsb2FkaW5nKSkuZm9yRWFjaCgoZm4pID0+IGZuICYmIGZuKCkpXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gd2FpdEZvclN1Y2Nlc3NmdWxQaW5nKG1zID0gMTAwMCkge1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZldGNoKGAke2Jhc2V9X192aXRlX3BpbmdgKVxuICAgICAgYnJlYWtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpXG4gICAgfVxuICB9XG59XG5cbi8vIHBpbmcgc2VydmVyXG5zb2NrZXQuYWRkRXZlbnRMaXN0ZW5lcignY2xvc2UnLCBhc3luYyAoeyB3YXNDbGVhbiB9KSA9PiB7XG4gIGlmICh3YXNDbGVhbikgcmV0dXJuXG4gIGNvbnNvbGUubG9nKGBbdml0ZV0gc2VydmVyIGNvbm5lY3Rpb24gbG9zdC4gcG9sbGluZyBmb3IgcmVzdGFydC4uLmApXG4gIGF3YWl0IHdhaXRGb3JTdWNjZXNzZnVsUGluZygpXG4gIGxvY2F0aW9uLnJlbG9hZCgpXG59KVxuXG4vLyBodHRwczovL3dpY2cuZ2l0aHViLmlvL2NvbnN0cnVjdC1zdHlsZXNoZWV0c1xuY29uc3Qgc3VwcG9ydHNDb25zdHJ1Y3RlZFNoZWV0ID0gKCgpID0+IHtcbiAgdHJ5IHtcbiAgICAvLyBuZXcgQ1NTU3R5bGVTaGVldCgpXG4gICAgLy8gcmV0dXJuIHRydWVcbiAgfSBjYXRjaCAoZSkge31cbiAgcmV0dXJuIGZhbHNlXG59KSgpXG5cbmNvbnN0IHNoZWV0c01hcCA9IG5ldyBNYXAoKVxuXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlU3R5bGUoaWQ6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogdm9pZCB7XG4gIGxldCBzdHlsZSA9IHNoZWV0c01hcC5nZXQoaWQpXG4gIGlmIChzdXBwb3J0c0NvbnN0cnVjdGVkU2hlZXQgJiYgIWNvbnRlbnQuaW5jbHVkZXMoJ0BpbXBvcnQnKSkge1xuICAgIGlmIChzdHlsZSAmJiAhKHN0eWxlIGluc3RhbmNlb2YgQ1NTU3R5bGVTaGVldCkpIHtcbiAgICAgIHJlbW92ZVN0eWxlKGlkKVxuICAgICAgc3R5bGUgPSB1bmRlZmluZWRcbiAgICB9XG5cbiAgICBpZiAoIXN0eWxlKSB7XG4gICAgICBzdHlsZSA9IG5ldyBDU1NTdHlsZVNoZWV0KClcbiAgICAgIHN0eWxlLnJlcGxhY2VTeW5jKGNvbnRlbnQpXG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBkb2N1bWVudC5hZG9wdGVkU3R5bGVTaGVldHMgPSBbLi4uZG9jdW1lbnQuYWRvcHRlZFN0eWxlU2hlZXRzLCBzdHlsZV1cbiAgICB9IGVsc2Uge1xuICAgICAgc3R5bGUucmVwbGFjZVN5bmMoY29udGVudClcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKHN0eWxlICYmICEoc3R5bGUgaW5zdGFuY2VvZiBIVE1MU3R5bGVFbGVtZW50KSkge1xuICAgICAgcmVtb3ZlU3R5bGUoaWQpXG4gICAgICBzdHlsZSA9IHVuZGVmaW5lZFxuICAgIH1cblxuICAgIGlmICghc3R5bGUpIHtcbiAgICAgIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKVxuICAgICAgc3R5bGUuc2V0QXR0cmlidXRlKCd0eXBlJywgJ3RleHQvY3NzJylcbiAgICAgIHN0eWxlLmlubmVySFRNTCA9IGNvbnRlbnRcbiAgICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpXG4gICAgfSBlbHNlIHtcbiAgICAgIHN0eWxlLmlubmVySFRNTCA9IGNvbnRlbnRcbiAgICB9XG4gIH1cbiAgc2hlZXRzTWFwLnNldChpZCwgc3R5bGUpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVTdHlsZShpZDogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IHN0eWxlID0gc2hlZXRzTWFwLmdldChpZClcbiAgaWYgKHN0eWxlKSB7XG4gICAgaWYgKHN0eWxlIGluc3RhbmNlb2YgQ1NTU3R5bGVTaGVldCkge1xuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgY29uc3QgaW5kZXggPSBkb2N1bWVudC5hZG9wdGVkU3R5bGVTaGVldHMuaW5kZXhPZihzdHlsZSlcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIGRvY3VtZW50LmFkb3B0ZWRTdHlsZVNoZWV0cyA9IGRvY3VtZW50LmFkb3B0ZWRTdHlsZVNoZWV0cy5maWx0ZXIoXG4gICAgICAgIChzOiBDU1NTdHlsZVNoZWV0KSA9PiBzICE9PSBzdHlsZVxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICBkb2N1bWVudC5oZWFkLnJlbW92ZUNoaWxkKHN0eWxlKVxuICAgIH1cbiAgICBzaGVldHNNYXAuZGVsZXRlKGlkKVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZldGNoVXBkYXRlKHsgcGF0aCwgYWNjZXB0ZWRQYXRoLCB0aW1lc3RhbXAgfTogVXBkYXRlKSB7XG4gIGNvbnN0IG1vZCA9IGhvdE1vZHVsZXNNYXAuZ2V0KHBhdGgpXG4gIGlmICghbW9kKSB7XG4gICAgLy8gSW4gYSBjb2RlLXNwbGl0dGluZyBwcm9qZWN0LFxuICAgIC8vIGl0IGlzIGNvbW1vbiB0aGF0IHRoZSBob3QtdXBkYXRpbmcgbW9kdWxlIGlzIG5vdCBsb2FkZWQgeWV0LlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS92aXRlanMvdml0ZS9pc3N1ZXMvNzIxXG4gICAgcmV0dXJuXG4gIH1cblxuICBjb25zdCBtb2R1bGVNYXAgPSBuZXcgTWFwKClcbiAgY29uc3QgaXNTZWxmVXBkYXRlID0gcGF0aCA9PT0gYWNjZXB0ZWRQYXRoXG5cbiAgLy8gbWFrZSBzdXJlIHdlIG9ubHkgaW1wb3J0IGVhY2ggZGVwIG9uY2VcbiAgY29uc3QgbW9kdWxlc1RvVXBkYXRlID0gbmV3IFNldDxzdHJpbmc+KClcbiAgaWYgKGlzU2VsZlVwZGF0ZSkge1xuICAgIC8vIHNlbGYgdXBkYXRlIC0gb25seSB1cGRhdGUgc2VsZlxuICAgIG1vZHVsZXNUb1VwZGF0ZS5hZGQocGF0aClcbiAgfSBlbHNlIHtcbiAgICAvLyBkZXAgdXBkYXRlXG4gICAgZm9yIChjb25zdCB7IGRlcHMgfSBvZiBtb2QuY2FsbGJhY2tzKSB7XG4gICAgICBkZXBzLmZvckVhY2goKGRlcCkgPT4ge1xuICAgICAgICBpZiAoYWNjZXB0ZWRQYXRoID09PSBkZXApIHtcbiAgICAgICAgICBtb2R1bGVzVG9VcGRhdGUuYWRkKGRlcClcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gIH1cblxuICAvLyBkZXRlcm1pbmUgdGhlIHF1YWxpZmllZCBjYWxsYmFja3MgYmVmb3JlIHdlIHJlLWltcG9ydCB0aGUgbW9kdWxlc1xuICBjb25zdCBxdWFsaWZpZWRDYWxsYmFja3MgPSBtb2QuY2FsbGJhY2tzLmZpbHRlcigoeyBkZXBzIH0pID0+IHtcbiAgICByZXR1cm4gZGVwcy5zb21lKChkZXApID0+IG1vZHVsZXNUb1VwZGF0ZS5oYXMoZGVwKSlcbiAgfSlcblxuICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICBBcnJheS5mcm9tKG1vZHVsZXNUb1VwZGF0ZSkubWFwKGFzeW5jIChkZXApID0+IHtcbiAgICAgIGNvbnN0IGRpc3Bvc2VyID0gZGlzcG9zZU1hcC5nZXQoZGVwKVxuICAgICAgaWYgKGRpc3Bvc2VyKSBhd2FpdCBkaXNwb3NlcihkYXRhTWFwLmdldChkZXApKVxuICAgICAgY29uc3QgW3BhdGgsIHF1ZXJ5XSA9IGRlcC5zcGxpdChgP2ApXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBuZXdNb2QgPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICAgLyogQHZpdGUtaWdub3JlICovXG4gICAgICAgICAgYmFzZSArXG4gICAgICAgICAgICBwYXRoLnNsaWNlKDEpICtcbiAgICAgICAgICAgIGA/aW1wb3J0JnQ9JHt0aW1lc3RhbXB9JHtxdWVyeSA/IGAmJHtxdWVyeX1gIDogJyd9YFxuICAgICAgICApXG4gICAgICAgIG1vZHVsZU1hcC5zZXQoZGVwLCBuZXdNb2QpXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHdhcm5GYWlsZWRGZXRjaChlLCBkZXApXG4gICAgICB9XG4gICAgfSlcbiAgKVxuXG4gIHJldHVybiAoKSA9PiB7XG4gICAgZm9yIChjb25zdCB7IGRlcHMsIGZuIH0gb2YgcXVhbGlmaWVkQ2FsbGJhY2tzKSB7XG4gICAgICBmbihkZXBzLm1hcCgoZGVwKSA9PiBtb2R1bGVNYXAuZ2V0KGRlcCkpKVxuICAgIH1cbiAgICBjb25zdCBsb2dnZWRQYXRoID0gaXNTZWxmVXBkYXRlID8gcGF0aCA6IGAke2FjY2VwdGVkUGF0aH0gdmlhICR7cGF0aH1gXG4gICAgY29uc29sZS5sb2coYFt2aXRlXSBob3QgdXBkYXRlZDogJHtsb2dnZWRQYXRofWApXG4gIH1cbn1cblxuaW50ZXJmYWNlIEhvdE1vZHVsZSB7XG4gIGlkOiBzdHJpbmdcbiAgY2FsbGJhY2tzOiBIb3RDYWxsYmFja1tdXG59XG5cbmludGVyZmFjZSBIb3RDYWxsYmFjayB7XG4gIC8vIHRoZSBkZXBlbmRlbmNpZXMgbXVzdCBiZSBmZXRjaGFibGUgcGF0aHNcbiAgZGVwczogc3RyaW5nW11cbiAgZm46IChtb2R1bGVzOiBvYmplY3RbXSkgPT4gdm9pZFxufVxuXG5jb25zdCBob3RNb2R1bGVzTWFwID0gbmV3IE1hcDxzdHJpbmcsIEhvdE1vZHVsZT4oKVxuY29uc3QgZGlzcG9zZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCAoZGF0YTogYW55KSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPj4oKVxuY29uc3QgcHJ1bmVNYXAgPSBuZXcgTWFwPHN0cmluZywgKGRhdGE6IGFueSkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD4+KClcbmNvbnN0IGRhdGFNYXAgPSBuZXcgTWFwPHN0cmluZywgYW55PigpXG5jb25zdCBjdXN0b21MaXN0ZW5lcnNNYXAgPSBuZXcgTWFwPHN0cmluZywgKChkYXRhOiBhbnkpID0+IHZvaWQpW10+KClcbmNvbnN0IGN0eFRvTGlzdGVuZXJzTWFwID0gbmV3IE1hcDxcbiAgc3RyaW5nLFxuICBNYXA8c3RyaW5nLCAoKGRhdGE6IGFueSkgPT4gdm9pZClbXT5cbj4oKVxuXG4vLyBKdXN0IGluZmVyIHRoZSByZXR1cm4gdHlwZSBmb3Igbm93XG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L2V4cGxpY2l0LW1vZHVsZS1ib3VuZGFyeS10eXBlc1xuZXhwb3J0IGNvbnN0IGNyZWF0ZUhvdENvbnRleHQgPSAob3duZXJQYXRoOiBzdHJpbmcpID0+IHtcbiAgaWYgKCFkYXRhTWFwLmhhcyhvd25lclBhdGgpKSB7XG4gICAgZGF0YU1hcC5zZXQob3duZXJQYXRoLCB7fSlcbiAgfVxuXG4gIC8vIHdoZW4gYSBmaWxlIGlzIGhvdCB1cGRhdGVkLCBhIG5ldyBjb250ZXh0IGlzIGNyZWF0ZWRcbiAgLy8gY2xlYXIgaXRzIHN0YWxlIGNhbGxiYWNrc1xuICBjb25zdCBtb2QgPSBob3RNb2R1bGVzTWFwLmdldChvd25lclBhdGgpXG4gIGlmIChtb2QpIHtcbiAgICBtb2QuY2FsbGJhY2tzID0gW11cbiAgfVxuXG4gIC8vIGNsZWFyIHN0YWxlIGN1c3RvbSBldmVudCBsaXN0ZW5lcnNcbiAgY29uc3Qgc3RhbGVMaXN0ZW5lcnMgPSBjdHhUb0xpc3RlbmVyc01hcC5nZXQob3duZXJQYXRoKVxuICBpZiAoc3RhbGVMaXN0ZW5lcnMpIHtcbiAgICBmb3IgKGNvbnN0IFtldmVudCwgc3RhbGVGbnNdIG9mIHN0YWxlTGlzdGVuZXJzKSB7XG4gICAgICBjb25zdCBsaXN0ZW5lcnMgPSBjdXN0b21MaXN0ZW5lcnNNYXAuZ2V0KGV2ZW50KVxuICAgICAgaWYgKGxpc3RlbmVycykge1xuICAgICAgICBjdXN0b21MaXN0ZW5lcnNNYXAuc2V0KFxuICAgICAgICAgIGV2ZW50LFxuICAgICAgICAgIGxpc3RlbmVycy5maWx0ZXIoKGwpID0+ICFzdGFsZUZucy5pbmNsdWRlcyhsKSlcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IG5ld0xpc3RlbmVycyA9IG5ldyBNYXAoKVxuICBjdHhUb0xpc3RlbmVyc01hcC5zZXQob3duZXJQYXRoLCBuZXdMaXN0ZW5lcnMpXG5cbiAgZnVuY3Rpb24gYWNjZXB0RGVwcyhkZXBzOiBzdHJpbmdbXSwgY2FsbGJhY2s6IEhvdENhbGxiYWNrWydmbiddID0gKCkgPT4ge30pIHtcbiAgICBjb25zdCBtb2Q6IEhvdE1vZHVsZSA9IGhvdE1vZHVsZXNNYXAuZ2V0KG93bmVyUGF0aCkgfHwge1xuICAgICAgaWQ6IG93bmVyUGF0aCxcbiAgICAgIGNhbGxiYWNrczogW11cbiAgICB9XG4gICAgbW9kLmNhbGxiYWNrcy5wdXNoKHtcbiAgICAgIGRlcHMsXG4gICAgICBmbjogY2FsbGJhY2tcbiAgICB9KVxuICAgIGhvdE1vZHVsZXNNYXAuc2V0KG93bmVyUGF0aCwgbW9kKVxuICB9XG5cbiAgY29uc3QgaG90ID0ge1xuICAgIGdldCBkYXRhKCkge1xuICAgICAgcmV0dXJuIGRhdGFNYXAuZ2V0KG93bmVyUGF0aClcbiAgICB9LFxuXG4gICAgYWNjZXB0KGRlcHM6IGFueSwgY2FsbGJhY2s/OiBhbnkpIHtcbiAgICAgIGlmICh0eXBlb2YgZGVwcyA9PT0gJ2Z1bmN0aW9uJyB8fCAhZGVwcykge1xuICAgICAgICAvLyBzZWxmLWFjY2VwdDogaG90LmFjY2VwdCgoKSA9PiB7fSlcbiAgICAgICAgYWNjZXB0RGVwcyhbb3duZXJQYXRoXSwgKFttb2RdKSA9PiBkZXBzICYmIGRlcHMobW9kKSlcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGRlcHMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIGV4cGxpY2l0IGRlcHNcbiAgICAgICAgYWNjZXB0RGVwcyhbZGVwc10sIChbbW9kXSkgPT4gY2FsbGJhY2sgJiYgY2FsbGJhY2sobW9kKSlcbiAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShkZXBzKSkge1xuICAgICAgICBhY2NlcHREZXBzKGRlcHMsIGNhbGxiYWNrKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbnZhbGlkIGhvdC5hY2NlcHQoKSB1c2FnZS5gKVxuICAgICAgfVxuICAgIH0sXG5cbiAgICBhY2NlcHREZXBzKCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgaG90LmFjY2VwdERlcHMoKSBpcyBkZXByZWNhdGVkLiBgICtcbiAgICAgICAgICBgVXNlIGhvdC5hY2NlcHQoKSB3aXRoIHRoZSBzYW1lIHNpZ25hdHVyZSBpbnN0ZWFkLmBcbiAgICAgIClcbiAgICB9LFxuXG4gICAgZGlzcG9zZShjYjogKGRhdGE6IGFueSkgPT4gdm9pZCkge1xuICAgICAgZGlzcG9zZU1hcC5zZXQob3duZXJQYXRoLCBjYilcbiAgICB9LFxuXG4gICAgcHJ1bmUoY2I6IChkYXRhOiBhbnkpID0+IHZvaWQpIHtcbiAgICAgIHBydW5lTWFwLnNldChvd25lclBhdGgsIGNiKVxuICAgIH0sXG5cbiAgICAvLyBUT0RPXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1lbXB0eS1mdW5jdGlvblxuICAgIGRlY2xpbmUoKSB7fSxcblxuICAgIGludmFsaWRhdGUoKSB7XG4gICAgICAvLyBUT0RPIHNob3VsZCB0ZWxsIHRoZSBzZXJ2ZXIgdG8gcmUtcGVyZm9ybSBobXIgcHJvcGFnYXRpb25cbiAgICAgIC8vIGZyb20gdGhpcyBtb2R1bGUgYXMgcm9vdFxuICAgICAgbG9jYXRpb24ucmVsb2FkKClcbiAgICB9LFxuXG4gICAgLy8gY3VzdG9tIGV2ZW50c1xuICAgIG9uOiAoZXZlbnQ6IHN0cmluZywgY2I6IChkYXRhOiBhbnkpID0+IHZvaWQpID0+IHtcbiAgICAgIGNvbnN0IGFkZFRvTWFwID0gKG1hcDogTWFwPHN0cmluZywgYW55W10+KSA9PiB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nID0gbWFwLmdldChldmVudCkgfHwgW11cbiAgICAgICAgZXhpc3RpbmcucHVzaChjYilcbiAgICAgICAgbWFwLnNldChldmVudCwgZXhpc3RpbmcpXG4gICAgICB9XG4gICAgICBhZGRUb01hcChjdXN0b21MaXN0ZW5lcnNNYXApXG4gICAgICBhZGRUb01hcChuZXdMaXN0ZW5lcnMpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGhvdFxufVxuXG4vKipcbiAqIHVybHMgaGVyZSBhcmUgZHluYW1pYyBpbXBvcnQoKSB1cmxzIHRoYXQgY291bGRuJ3QgYmUgc3RhdGljYWxseSBhbmFseXplZFxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5qZWN0UXVlcnkodXJsOiBzdHJpbmcsIHF1ZXJ5VG9JbmplY3Q6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIHNraXAgdXJscyB0aGF0IHdvbid0IGJlIGhhbmRsZWQgYnkgdml0ZVxuICBpZiAoIXVybC5zdGFydHNXaXRoKCcuJykgJiYgIXVybC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICByZXR1cm4gdXJsXG4gIH1cblxuICAvLyBjYW4ndCB1c2UgcGF0aG5hbWUgZnJvbSBVUkwgc2luY2UgaXQgbWF5IGJlIHJlbGF0aXZlIGxpa2UgLi4vXG4gIGNvbnN0IHBhdGhuYW1lID0gdXJsLnJlcGxhY2UoLyMuKiQvLCAnJykucmVwbGFjZSgvXFw/LiokLywgJycpXG4gIGNvbnN0IHsgc2VhcmNoLCBoYXNoIH0gPSBuZXcgVVJMKHVybCwgJ2h0dHA6Ly92aXRlanMuZGV2JylcblxuICByZXR1cm4gYCR7cGF0aG5hbWV9PyR7cXVlcnlUb0luamVjdH0ke3NlYXJjaCA/IGAmYCArIHNlYXJjaC5zbGljZSgxKSA6ICcnfSR7XG4gICAgaGFzaCB8fCAnJ1xuICB9YFxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsTUFBTSxRQUFRLFlBQVk7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBOEd6QixDQUFBO0FBRUQsTUFBTSxNQUFNLEdBQUcsZ0NBQWdDLENBQUE7QUFDL0MsTUFBTSxXQUFXLEdBQUcsMENBQTBDLENBQUE7TUFFakQsWUFBYSxTQUFRLFdBQVc7SUFHM0MsWUFBWSxHQUF3Qjs7UUFDbEMsS0FBSyxFQUFFLENBQUE7UUFDUCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQTtRQUMvQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUE7UUFFOUIsV0FBVyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUE7UUFDekIsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLEtBQUssSUFBSSxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQTtRQUN6RCxNQUFNLE9BQU8sR0FBRyxRQUFRO2NBQ3BCLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUM7Y0FDcEMsR0FBRyxDQUFDLE9BQU8sQ0FBQTtRQUNmLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRTtZQUNk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