/** `ssh_exec`: one command on one configured host, bounded and cancellable. */
import { positiveInt } from '../config.js'
import { connectionFor } from '../connection.js'
import { createLiveDecoder } from '../encoding.js'
import { commonArgs, destinationOf, requireHost } from '../openssh.js'
import { startActivity } from '../live.js'
import { resolveHostOs } from '../remote.js'
import { runClient } from '../process.js'
import { HOST_SCHEMA, asRecord, requireString, textBlock, textOf } from './shared.js'

/** Human-readable note for a stream heading: `truncated, gbk`, `gbk`, or ''. */
function streamLabel(truncated, encoding) {
  const parts = []
  if (truncated === true) parts.push('truncated')
  if (encoding === 'gbk') parts.push('gbk')
  return parts.join(', ')
}

function renderExec(value) {
  const lines = [
    `ssh ${value.host} exit=${value.exitCode} via=${value.via}${value.signal === '' ? '' : ` signal=${value.signal}`}` +
      `${value.timedOut ? ' TIMED OUT' : ''} in ${value.durationMs}ms` +
      `${value.sessionReset ? ' (session reset)' : ''}`,
  ]
  if (value.stdout !== '') {
    const label = streamLabel(value.truncatedStdout, value.stdoutEncoding)
    lines.push(`--- stdout${label === '' ? '' : ` (${label})`} ---`)
    lines.push(value.stdout.replace(/\n$/, ''))
  }
  if (value.stderr !== '') {
    const label = streamLabel(value.truncatedStderr, value.stderrEncoding)
    lines.push(`--- stderr${label === '' ? '' : ` (${label})`} ---`)
    lines.push(value.stderr.replace(/\n$/, ''))
  }
  if (value.stdout === '' && value.stderr === '') lines.push('(no output)')
  return lines.join('\n')
}

function sshExecTool(getConfig, askpass, live, detector, sessions) {
  return {
    name: 'ssh_exec',
    description:
      'Run one shell command on a configured remote host over SSH and return its exit code, stdout and stderr. ' +
      "The command runs in that host's login shell with the configured user's privileges, so it can change remote state " +
      '(files, services, packages); nothing is sandboxed remotely. Each stream is capped by the plugin maxOutputBytes. ' +
      'By default each host keeps one authenticated shell alive, so consecutive calls skip re-authentication and keep ' +
      'the working directory and environment (via=session); pass "fresh": true for an isolated one-shot connection. ' +
      'Output bytes are decoded as UTF-8, falling back to GBK, so a Chinese Windows cmd.exe host reads correctly ' +
      'without running chcp. Success is exitCode 0: OpenSSH may still print informational warnings on stderr. ' +
      'Check the host\'s "os" in ssh_hosts first: a linux or macos host runs a POSIX shell, ' +
      'a windows host runs cmd.exe (use Windows commands and %VARIABLE% syntax there). ' +
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
            'Command line handed to the remote login shell; pipes, redirection, quoting and && work as in a shell. ' +
            'In a Windows session it must be one line (join steps with "&"); multi-line commands need "fresh": true.',
        },
        timeoutMs: {
          type: 'integer',
          description:
            'Kill the call after this many milliseconds (defaults to the host or plugin command timeout). ' +
            'In a persistent session a timeout also resets the shell: the next call reconnects and loses cd/env state.',
        },
        fresh: {
          type: 'boolean',
          description:
            'Open a one-shot ssh connection for this call instead of using the persistent shell. ' +
            'Use it for multi-line scripts or for commands that read stdin (more, pause, set /p).',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'host',
          'via',
          'exitCode',
          'signal',
          'stdout',
          'stderr',
          'stdoutEncoding',
          'stderrEncoding',
          'truncatedStdout',
          'truncatedStderr',
          'durationMs',
          'timedOut',
          'sessionReset',
        ],
        properties: {
          host: { type: 'string' },
          via: { type: 'string', enum: ['session', 'one-shot'] },
          exitCode: { type: 'integer' },
          signal: { type: 'string' },
          stdout: { type: 'string' },
          stderr: { type: 'string' },
          stdoutEncoding: { type: 'string', enum: ['utf-8', 'gbk'] },
          stderrEncoding: { type: 'string', enum: ['utf-8', 'gbk'] },
          truncatedStdout: { type: 'boolean' },
          truncatedStderr: { type: 'boolean' },
          durationMs: { type: 'integer' },
          timedOut: { type: 'boolean' },
          sessionReset: { type: 'boolean' },
        },
      },
      render: (_args, value) => textBlock(renderExec(value)),
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const { config } = getConfig()
      const input = asRecord(args, 'ssh_exec')
      const configured = requireHost(config, requireString(input, 'host', 'ssh_exec'))
      const command = requireString(input, 'command', 'ssh_exec')
      const timeoutMs = positiveInt(input.timeoutMs, configured.commandTimeoutMs)
      const connection = await connectionFor(configured, askpass)
      const host = await resolveHostOs(config, configured, connection, detector)
      const activity = startActivity(live, {
        host: host.name,
        tool: 'ssh_exec',
        detail: command,
      })
      // Live chunks are decoded incrementally with the same rules as the final
      // result, so the sidebar never shows a permanent replacement-character burst.
      const decoders = {
        stdout: createLiveDecoder(config.remoteEncoding),
        stderr: createLiveDecoder(config.remoteEncoding),
      }
      const onChunk = (stream, chunk) => {
        const text = decoders[stream].push(chunk)
        if (text !== '') activity.chunk(stream, text)
      }
      const flushLive = () => {
        for (const stream of ['stdout', 'stderr']) {
          const text = decoders[stream].flush()
          if (text !== '') activity.chunk(stream, text)
        }
      }
      const options = { timeoutMs, signal: exec?.signal, onChunk }
      let result
      let via = 'session'
      if (input.fresh !== true && config.sessionMode !== 'off') {
        try {
          result = await sessions.run(host, connection, command, options)
        } catch (error) {
          if (error?.unavailable !== true) {
            activity.fail(error)
            throw error
          }
          // The shell could not be opened at all (protocol mismatch, ssh
          // failure): fall back to a one-shot connection rather than failing.
          via = 'one-shot'
        }
      } else {
        via = 'one-shot'
      }
      if (result === undefined) {
        const argv = [...commonArgs(host, connection.interactive, '-p'), destinationOf(host), command]
        try {
          result = await runClient(config.sshPath, argv, {
            env: connection.env,
            timeoutMs,
            signal: exec?.signal,
            maxOutputBytes: config.maxOutputBytes,
            encoding: config.remoteEncoding,
            onChunk,
          })
        } catch (error) {
          activity.fail(error)
          throw error
        }
      }
      flushLive()
      activity.end(result)
      return { host: host.name, via, sessionReset: result.sessionReset === true, ...result }
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
