/**
 * The plugin `Config` schema.
 *
 * The Harness projects this schema into the native settings form (Settings ->
 * Plugins -> this bundle), validates every profile row against it, and writes
 * form edits back through the Loader — so the panel and the YAML patch share one
 * source of truth. Field descriptions are the form's helper text, therefore they
 * are user-facing copy rather than implementation notes.
 */
import z from '@deepseek-ai/schemastery'

const AUTH_KINDS = ['agent', 'key', 'password']
const STRICT_KINDS = ['accept-new', 'yes', 'no', 'ask']
const SCP_MODES = ['sftp', 'legacy']

/** One allow-listed remote host. */
const Host = z.object({
  name: z.string().required().description('别名，工具调用时用它指定主机（同一配置内唯一）'),
  host: z.string().description('主机名或 IP；留空则用别名本身，可直接复用 ~/.ssh/config 里已有的 Host 别名'),
  port: z.natural().default(22).description('SSH 端口'),
  username: z.string().description('登录用户；留空则由 ssh 自己解析（含 ~/.ssh/config）'),
  description: z.string().description('备注，仅用于展示'),
  auth: z
    .union(AUTH_KINDS.map((kind) => z.const(kind)))
    .default('agent')
    .description('认证方式：agent（交给 OpenSSH/ssh-agent）、key（私钥）、password（密码）'),
  identityFile: z.string().description('私钥路径，auth=key 时使用；支持 ~'),
  password: z
    .string()
    .description('登录密码（明文保存在 profile 的 cordis.patch.yml；不想落盘就用 passwordEnv / passwordFile）'),
  passwordEnv: z.string().description('密码或私钥口令所在的环境变量名（推荐，配置文件里不落明文）'),
  passwordFile: z.string().description('密码或私钥口令所在的 0600 文件；与 passwordEnv 二选一'),
  knownHostsFile: z.string().description('自定义 known_hosts 文件；留空用 ssh 默认（~/.ssh/known_hosts）'),
  strictHostKeyChecking: z
    .union(STRICT_KINDS.map((kind) => z.const(kind)))
    .default('accept-new')
    .description('主机密钥校验：accept-new（首次信任）、yes（严格）、no、ask'),
  extraOptions: z
    .array(z.string())
    .description('追加的 -o Key=Value，例如 ProxyJump=bastion'),
  connectTimeoutSec: z.natural().description('连接超时（秒），留空用全局值'),
  commandTimeoutMs: z.natural().description('命令超时（毫秒），留空用全局值'),
})

export const Config = z.object({
  hosts: z.array(Host).default([]).description('允许连接的远程主机白名单；未列出的别名一律拒绝'),
  commandTimeoutMs: z.natural().default(60_000).description('每条命令的默认超时（毫秒）'),
  connectTimeoutSec: z.natural().default(15).description('连接与认证超时（秒）'),
  maxOutputBytes: z.natural().default(65_536).description('stdout / stderr 各自的字节上限，超出会明确标注截断'),
  scpMode: z
    .union(SCP_MODES.map((mode) => z.const(mode)))
    .default('sftp')
    .description('scp 远端路径的传法：sftp（默认，OpenSSH 9+ 原样传，空格与引号安全）、legacy（按远端 shell 加引号，仅给旧协议/加 -O 的场景）'),
  sshPath: z.string().default('ssh').description('ssh 可执行文件路径'),
  scpPath: z.string().default('scp').description('scp 可执行文件路径'),
  askpassPath: z
    .string()
    .description('自定义 SSH_ASKPASS helper（Windows 上若自动生成的 .cmd 不被接受时使用）'),
})

export default Config
