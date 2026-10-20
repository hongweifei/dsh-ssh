/** `ssh_upload`: local file to a configured host over scp. */
import { statSync } from 'node:fs'
import { positiveInt, resolveLocal } from '../config.js'
import { connectionFor } from '../connection.js'
import { commonArgs, destinationOf, remotePathArgument, remoteShellQuote, requireHost } from '../openssh.js'
import { startActivity } from '../live.js'
import { runClient } from '../process.js'
import { HOST_SCHEMA, asRecord, requireString, textBlock, transferOutputSchema } from './shared.js'

function sshUploadTool(config, askpass, live) {
  return {
    name: 'ssh_upload',
    description:
      'Copy one local file to a configured remote host with scp. The remote parent directory must already exist. ' +
      'Returns the number of bytes sent.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['host', 'localPath', 'remotePath'],
      properties: {
        host: HOST_SCHEMA,
        localPath: { type: 'string', description: 'Local source file; a leading "~" expands to the home directory.' },
        remotePath: {
          type: 'string',
          description: 'Destination path on the remote host. Spaces and quotes are safe: the path is passed through as given.',
        },
        mode: {
          type: 'string',
          description: 'Optional octal permission bits (for example "644") applied with chmod after the copy.',
        },
        timeoutMs: {
          type: 'integer',
          description: 'Give up after this many milliseconds (defaults to the host or plugin command timeout); raise it for large files.',
        },
      },
    },
    output: {
      schema: transferOutputSchema({ mode: { type: 'string' } }),
      render: (_args, value) =>
        textBlock(
          `copied ${value.localPath} → ${value.host}:${value.remotePath} (${value.bytes} bytes)` +
            (value.mode === '' ? '; mode unchanged' : `; mode ${value.mode}`),
        ),
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const input = asRecord(args, 'ssh_upload')
      const host = requireHost(config, requireString(input, 'host', 'ssh_upload'))
      const localPath = resolveLocal(requireString(input, 'localPath', 'ssh_upload'))
      const remotePath = requireString(input, 'remotePath', 'ssh_upload')
      const mode = input.mode === undefined ? '' : requireString(input, 'mode', 'ssh_upload')
      const timeoutMs = positiveInt(input.timeoutMs, host.commandTimeoutMs)
      if (mode !== '' && !/^[0-7]{3,4}$/.test(mode)) {
        throw new Error(`ssh_upload: "mode" must be octal permission bits such as "644"; got "${mode}"`)
      }
      let size
      try {
        const info = statSync(localPath)
        if (!info.isFile()) throw new Error('not a regular file')
        size = info.size
      } catch (error) {
        throw new Error(
          `ssh_upload: cannot read local file ${localPath}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      const connection = await connectionFor(host, askpass)
      const activity = startActivity(live, {
        host: host.name,
        tool: 'ssh_upload',
        detail: `${localPath} -> ${remotePath}`,
      })
      const argv = [
        ...commonArgs(host, connection.interactive, '-P'),
        localPath,
        `${destinationOf(host)}:${remotePathArgument(config, remotePath)}`,
      ]
      const result = await runClient(config.scpPath, argv, {
        env: connection.env,
        timeoutMs,
        signal: exec?.signal,
        maxOutputBytes: config.maxOutputBytes,
        onChunk: (stream, chunk) => activity.chunk(stream, chunk.toString('utf8')),
      })
      if (result.exitCode !== 0) {
        activity.fail(new Error(`scp exit ${result.exitCode}`))
        throw new Error(`ssh_upload failed (scp exit ${result.exitCode}): ${(result.stderr || result.stdout).trim()}`)
      }
      activity.end(result)
      if (mode !== '') {
        const chmod = await runClient(
          config.sshPath,
          [...commonArgs(host, connection.interactive, '-p'), destinationOf(host), `chmod ${mode} -- ${remoteShellQuote(remotePath)}`],
          {
            env: connection.env,
            timeoutMs,
            signal: exec?.signal,
            maxOutputBytes: config.maxOutputBytes,
          },
        )
        if (chmod.exitCode !== 0) {
          throw new Error(`ssh_upload: copied the file but chmod ${mode} failed: ${(chmod.stderr || chmod.stdout).trim()}`)
        }
      }
      return { host: host.name, localPath, remotePath, bytes: size, mode }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: `ssh_upload ${typeof args?.host === 'string' ? args.host : ''}`.trim(),
      kind: 'other',
      rawInput: args,
    }),
  }
}

export { transferOutputSchema, sshUploadTool }
