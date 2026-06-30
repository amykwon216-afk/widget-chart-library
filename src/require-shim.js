// Shim CommonJS `require` so pre-bundled CJS inside @thryvlabs/dex-react
// (use-sync-external-store etc.) can resolve React at runtime in the browser.
import * as _React from 'react'
import * as _ReactDOM from 'react-dom'
import * as _ReactDOMClient from 'react-dom/client'
import * as _ReactJSXRuntime from 'react/jsx-runtime'
import * as _ReactJSXDev from 'react/jsx-dev-runtime'

const _reactModule = { ..._React, default: _React.default || _React }
const _reactDomModule = { ..._ReactDOM, default: _ReactDOM.default || _ReactDOM }

const _requireMap = {
  'react': _reactModule,
  'react-dom': _reactDomModule,
  'react-dom/client': _ReactDOMClient,
  'react/jsx-runtime': _ReactJSXRuntime,
  'react/jsx-dev-runtime': _ReactJSXDev,
}

if (typeof globalThis.require === 'undefined') {
  globalThis.require = (name) => {
    if (_requireMap[name]) return _requireMap[name]
    throw new Error('Browser require shim: cannot resolve "' + name + '"')
  }
}
