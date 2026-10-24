/**
 * The client bundle of the plugin.
 *
 * The Harness loads client modules as single bundles through its own module
 * loader, so the client code is bundled here. The sources live in
 * `src/client/`; `build-client.mjs` regenerates this file.
 */
window.__ModuleLoader__.load({
  id: 'dsh-ssh',
  factory: (require) => {
    const react = require('react')
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const install = __DSH_SSH_INSTALL__
    const plugin = install(react, __DSH_SSH_JSX__, __DSH_SSH_JSXS__)
    exports.apply = plugin.apply
    exports.inject = plugin.inject
    exports.pages = plugin.pages
    return module.exports
  },
})
