/** `ssh_exec`: one command on one configured host, bounded and cancellable. */
import { positiveInt } from '../config.js'
import { connectionFor } from '../connection.js'
import { commonArgs, destinationOf, requireHost } from '../openssh.js'
import { startActivity } from '../live.js'
import { runClient } from '../process.js'
import { HOST_SCHEMA, asRecord, requireString, textBlock, textOf } from './shared.js'
function renderExec(value) {
  const lines = [
    `ssh ${value.host} exit=${value.exitCode}${value.signal === '' ? '' : ` signal=${value.signal}`}` +
      `${value.timedOut ? ' TIMED OUT' : ''} in ${value.durationMs}ms`,
  ]
  if (value.stdout !== '') {
    lines.push(`--- stdout${value.truncatedStdout ? ' (truncated)' : ''} ---`)
    lines.push(value.stdout.replace(/\n$/, ''))
  }
  if (value.stderr !== '') {
    lines.push(`--- stderr${value.truncatedStderr ? ' (truncated)' : ''} ---`)
    lines.push(value.stderr.replace(/\n$/, ''))
  }
  if (value.stdout === '' && value.stderr === '') lines.push('(no output)')
  return lines.join('\n')
}
function sshExecTool(config, askpass, live) {
  return {
    name: 'ssh_exec',
    description:
      'Run one shell command on a configured remote host over SSH and return its exit code, stdout and stderr. ' +
      "The command runs in that host's login shell with the configured user's privileges, so it can change remote state " +
      '(files, services, packages); nothing is sandboxed remotely. Each stream is capped by the plugin maxOutputBytes. ' +
      'Success is exitCode 0: OpenSSH may still print informational warnings on stderr. ' +
      'Use ssh_hosts to list the allowed aliases.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['host', 'command'],
      properties: {
        host: HOST_SCHEMA,
        command: {
          type: 'string',
          description:
            'Command line handed to the remote login shell; pipes, redirection, quoting and && work as in a shell.',
        },
        timeoutMs: {
          type: 'integer',
          description:
            'Kill the call after this many milliseconds (defaults to the host or plugin command timeout). The remote process may keep running.',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'host',
          'exitCode',
          'signal',
          'stdout',
          'stderr',
          'truncatedStdout',
          'truncatedStderr',
          'durationMs',
          'timedOut',
        ],
        properties: {
          host: { type: 'string' },
          exitCode: { type: 'integer' },
          signal: { type: 'string' },
          stdout: { type: 'string' },
          stderr: { type: 'string' },
          truncatedStdout: { type: 'boolean' },
          truncatedStderr: { type: 'boolean' },
          durationMs: { type: 'integer' },
          timedOut: { type: 'boolean' },
        },
      },
      render: (_args, value) => textBlock(renderExec(value)),
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const input = asRecord(args, 'ssh_exec')
      const host = requireHost(config, requireString(input, 'host', 'ssh_exec'))
      const command = requireString(input, 'command', 'ssh_exec')
      const timeoutMs = positiveInt(input.timeoutMs, host.commandTimeoutMs)
      const connection = await connectionFor(host, askpass)
      const activity = startActivity(live, {
        host: host.name,
        tool: 'ssh_exec',
        detail: command,
      })
      const argv = [
        ...commonArgs(host, connection.interactive, '-p'),
        destinationOf(host),
        command,
      ]
      let result
      try {
        result = await runClient(config.sshPath, argv, {
          env: connection.env,
          timeoutMs,
          signal: exec?.signal,
        maxOutputBytes: config.maxOutputBytes,
          onChunk: (stream, chunk) => activity.chunk(stream, chunk.toString('utf8')),
        })
      } catch (error) {
        activity.fail(error)
        throw error
      }
      activity.end(result)
      return { host: host.name, ...result }
    },
    presentCall: (args) => ({
      card: 'terminal',
      title: `ssh_exec ${typeof args?.host === 'string' ? args.host : ''}`.trim(),
      description: typeof args?.command === 'string' ? args.command : undefined,
    }),
    presentResult: (args, result) => ({
      card: 'terminal',
      title: `ssh_exec ${typeof args?.host === 'string' ? args.host : ''}`.trim(),
      output: textOf(result),
    }),
  }
}

export { sshExecTool }
