/**
 * Small building blocks shared by the settings page and the terminal page.
 *
 * They are plain elements styled with the Harness theme tokens, so the pages
 * look like the rest of the application without importing any Harness client
 * package.
 */

/** The JSX factory, provided by the entry module when the bundle starts. */
let factory = null

/**
 * Set the JSX factory the components build their elements with.
 * @param jsxFactory - the JSX factory from the module loader.
 */
export function setJsxFactory(jsxFactory) {
  factory = jsxFactory
}

/** The JSX factory, failing loudly when the bundle was not set up. */
function jsxOf(props) {
  const resolved = props?.jsx ?? factory
  if (typeof resolved !== 'function') {
    throw new Error('dsh-ssh client: the JSX factory was not provided')
  }
  return resolved
}

/** A labeled text input. */
export function TextField(props) {
  const jsx = jsxOf(props)
  return jsx('label', {
    className: 'dssField',
    children: [
      jsx('span', { className: 'dssLabel', children: props.label }),
      jsx('input', {
        className: 'dssInput',
        type: props.type ?? 'text',
        value: props.value ?? '',
        placeholder: props.placeholder ?? '',
        'aria-invalid': props.invalid === true ? 'true' : undefined,
        onChange: (event) => props.onChange(event.target.value),
      }),
      props.hint === undefined ? null : jsx('span', { className: 'dssHint', children: props.hint }),
    ],
  })
}

/**
 * A row of mutually exclusive choices.
 *
 * The native select is replaced on purpose: its option list is drawn by the
 * browser and cannot be styled to match the theme, while these buttons are drawn
 * by the page and therefore always readable.
 */
export function Segmented(props) {
  const jsx = jsxOf(props)
  return jsx('div', {
    className: 'dssSeg',
    role: 'group',
    'aria-label': props.label,
    children: props.options.map((option) =>
      jsx('button', {
        key: option.value,
        type: 'button',
        className: 'dssSegBtn',
        'aria-pressed': option.value === props.value ? 'true' : 'false',
        title: option.title,
        onClick: () => props.onChange(option.value),
        children: option.label,
      }),
    ),
  })
}

/** A button. */
export function Button(props) {
  const jsx = jsxOf(props)
  const className = [
    'dssBtn',
    props.variant === 'primary' ? 'dssBtnPrimary' : '',
    props.variant === 'danger' ? 'dssBtnDanger' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return jsx('button', {
    type: 'button',
    className,
    disabled: props.disabled === true,
    onClick: props.onClick,
    title: props.title,
    children: props.children,
  })
}

/** A small status label. */
export function Tag(props) {
  const jsx = jsxOf(props)
  return jsx('span', { className: 'dssTag', 'data-tone': props.tone, children: props.children })
}

/** The chevron of a collapsible row. */
export function Caret(props) {
  const jsx = jsxOf(props)
  return jsx('svg', {
    className: 'dssCaret',
    'data-open': props.open === true ? 'true' : 'false',
    width: 12,
    height: 12,
    viewBox: '0 0 16 16',
    fill: 'none',
    'aria-hidden': 'true',
    children: jsx('path', {
      d: 'M6 3.5 10.5 8 6 12.5',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  })
}

/** A titled group of fields. */
export function Group(props) {
  const jsx = jsxOf(props)
  return jsx('section', {
    className: 'dssGroup',
    children: [
      jsx('h4', { className: 'dssGroupTitle', children: props.title }),
      jsx('div', { className: 'dssGrid', children: props.children }),
    ],
  })
}
