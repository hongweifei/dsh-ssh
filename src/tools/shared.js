/** Small pieces every tool definition shares: argument checks and render helpers. */

function asRecord(args, toolName) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error(`${toolName}: arguments must be an object`)
  }
  return args
}

function requireString(args, field, toolName) {
  const value = args[field]
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${toolName}: "${field}" is required and must be a non-empty string`)
  }
  return value
}

const HOST_SCHEMA = {
  type: 'string',
  description: 'Alias of a host declared in the dsh-ssh plugin config; call ssh_hosts to list them.',
}

function textBlock(text) {
  return [{ type: 'text', text }]
}

function textOf(result) {
  const content = result !== null && typeof result === 'object' && Array.isArray(result.content)
    ? result.content
    : []
  return content
    .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

function transferOutputSchema(extra) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['host', 'localPath', 'remotePath', 'bytes'],
    properties: {
      host: { type: 'string' },
      localPath: { type: 'string' },
      remotePath: { type: 'string' },
      bytes: { type: 'integer' },
      ...extra,
    },
  }
}

export { asRecord, requireString, HOST_SCHEMA, textBlock, textOf, transferOutputSchema }
