/** `ssh_hosts`: the configured host inventory, secrets excluded. */
import { textBlock } from './shared.js'
function renderHosts(value) {
  const lines = []
  if (value.hosts.length === 0) {
    lines.push('No SSH hosts are configured for this profile.')
    lines.push('Add them under the "dsh-ssh" entry in ~/.dsh/profiles/<profile>/cordis.patch.yml, for example:')
    lines.push('  config:')
    lines.push('    hosts:')
    lines.push('      - name: prod')
    lines.push('        host: example.com')
    lines.push('        username: deploy')
    lines.push('        auth: password')
    lines.push('        passwordEnv: DSH_SSH_PROD_PASSWORD')
  } else {
    lines.push(`${value.hosts.length} SSH host${value.hosts.length === 1 ? '' : 's'} configured:`)
    for (const host of value.hosts) {
      const user = host.username === '' ? '' : `${host.username}@`
      const note = host.description === '' ? '' : `  — ${host.description}`
      lines.push(`- ${host.name} → ${user}${host.destination}:${host.port} [auth=${host.auth} os=${host.os}${host.detectedOs === '' ? '' : ` detected=${host.detectedOs}`}]${note}`)
    }
  }
  for (const warning of value.warnings) lines.push(`warning: ${warning}`)
  return lines.join('\n')
}
function sshHostsTool(getConfig, detector) {
  return {
    name: 'ssh_hosts',
    description:
      'List the SSH hosts this profile may reach through the dsh-ssh plugin: alias, destination, user, authentication kind, operating system and description. Call it before ssh_exec to learn which aliases exist and what shell each host runs.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['hosts', 'warnings'],
        properties: {
          hosts: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'destination', 'port', 'username', 'auth', 'os', 'detectedOs', 'description'],
              properties: {
                name: { type: 'string' },
                destination: { type: 'string' },
                port: { type: 'integer' },
                username: { type: 'string' },
                auth: { type: 'string', enum: ['agent', 'key', 'password'] },
                os: { type: 'string', enum: ['auto', 'linux', 'macos', 'windows'] },
                detectedOs: { type: 'string', enum: ['', 'linux', 'macos', 'windows'] },
                description: { type: 'string' },
              },
            },
          },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
      render: (_args, value) => textBlock(renderHosts(value)),
    },
    isConcurrencySafe: () => true,
    async execute() {
      const { config, warnings } = getConfig()
      return {
        hosts: config.hosts.map((host) => ({
          name: host.name,
          destination: host.hostname,
          port: host.port,
          username: host.username ?? '',
          auth: host.auth,
          os: host.os,
          detectedOs: detector.get(host) ?? '',
          description: host.description,
        })),
        warnings: [...warnings],
      }
    },
    presentCall: () => ({ card: 'generic', title: 'ssh_hosts', kind: 'other' }),
  }
}

export { sshHostsTool }
