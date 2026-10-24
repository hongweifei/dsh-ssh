/**
 * A minimal JSX runtime.
 *
 * The Harness provides `react` through its module loader, but the JSX runtime
 * sub-path is not part of that contract, so the bundle carries its own. It only
 * needs to create elements, which is all the pages use.
 *
 * `jsx` and `jsxs` differ in one way: `jsxs` takes its children as an array
 * argument, and React needs that array in the element's props.
 */

/** Create one element. */
export function jsx(type, props, key) {
  const { children, ...rest } = props ?? {}
  const element = { $$typeof: Symbol.for('react.element'), type, key: key ?? null, ref: null, props: rest }
  if (children !== undefined) element.props.children = children
  return element
}

/** Create one element whose children are an array. */
export function jsxs(type, props, key) {
  const { children, ...rest } = props ?? {}
  const list = Array.isArray(children) ? children : children === undefined ? [] : [children]
  // React drops array children that carry no key, so every entry gets one.
  const keyed = list.map((child, index) => {
    if (child === null || child === undefined || typeof child !== 'object') return child
    if (child.key !== null && child.key !== undefined) return child
    return { ...child, key: `${type}-${index}` }
  })
  return { $$typeof: Symbol.for('react.element'), type, key: key ?? null, ref: null, props: { ...rest, children: keyed } }
}
