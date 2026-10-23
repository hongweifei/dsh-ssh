/** `ssh_download`: remote file to the local machine over scp. */
import { mkdirSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { positiveInt, resolveLocal } from '../config.js'
import { connectionFor } from '../connection.js'
import { commonArgs, destinationOf, remotePathArgument, requireHost } from '../openssh.js'
import { startActivity } from '../live.js'
import { runClient } from '../process.js'
import { HOST_SCHEMA, asRecord, requireString, textBlock, transferOutputSchema } from './shared.js'
function sshDownloadTool(getConfig, askpass, live) {
  return {
    name: 'ssh_download',
    description:
      'Copy one file from a configured remote host to the local machine with scp, creating local parent directories. ' +
      'Returns the number of bytes written.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['host', 'remotePath', 'localPath'],
      properties: {
        host: HOST_SCHEMA,
        remotePath: {
          type: 'string',
          description: 'Source path on the remote host. Spaces and quotes are safe: the path is passed through as given.',
        },
        localPath: { type: 'string', description: 'Local destination file; a leading "~" expands to the home directory.' },
        timeoutMs: {
          type: 'integer',
          description: 'Give up after this many milliseconds (defaults to the host or plugin command timeout); raise it for large files.',
        },
      },
    },
    output: {
      schema: transferOutputSchema({}),
      render: (_args, value) =>
        textBlock(`copied ${value.host}:${value.remotePath} → ${value.localPath} (${value.bytes} bytes)`),
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const { config } = getConfig()
      const input = asRecord(args, 'ssh_download')
      const host = requireHost(config, requireString(input, 'host', 'ssh_download'))
      const remotePath = requireString(input, 'remotePath', 'ssh_download')
      const localPath = resolveLocal(requireString(input, 'localPath', 'ssh_download'))
      const timeoutMs = positiveInt(input.timeoutMs, host.commandTimeoutMs)
      const connection = await connectionFor(host, askpass)
      const activity = startActivity(live, {
        host: host.name,
        tool: 'ssh_download',
        detail: `${remotePath} -> ${localPath}`,
      })
      mkdirSync(dirname(localPath), { recursive: true })
      const argv = [
        ...commonArgs(host, connection.interactive, '-P'),
        `${destinationOf(host)}:${remotePathArgument(config, remotePath)}`,
        localPath,
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
        throw new Error(`ssh_download failed (scp exit ${result.exitCode}): ${(result.stderr || result.stdout).trim()}`)
      }
      activity.end(result)
      let bytes = 0
      try {
        bytes = statSync(localPath).size
      } catch {
        bytes = 0
      }
      return { host: host.name, localPath, remotePath, bytes }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: `ssh_download ${typeof args?.host === 'string' ? args.host : ''}`.trim(),
      kind: 'other',
      rawInput: args,
    }),
  }
}

export { sshDownloadTool }
