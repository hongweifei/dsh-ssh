# dsh-ssh

给 DeepSeek Harness 增加「在远程主机上跑命令 / 传文件」的能力。装一次，之后 Agent 就能用
`ssh_exec` 之类的工具操作你在配置里点过名的主机。

- **零依赖**：不装任何 npm 包，只用 Node 内置模块 + 系统自带的 OpenSSH 客户端
  （`ssh` / `scp`）。Linux、macOS、Windows 10+ 都能跑。
- **白名单**：只有 `config.hosts` 里声明过的别名能连，别的目的地一律拒绝。
- **不碰 TTY**：密码/口令走 `SSH_ASKPASS`（OpenSSH 8.4+），因此没有终端也能认证；
  密码只出现在子进程环境里，不进 argv、不进日志、不回给模型。

## 工具

| 工具             | 作用                                        | 关键参数                                                     |
| -------------- | ----------------------------------------- | -------------------------------------------------------- |
| `ssh_hosts`    | 列出本 profile 允许的主机与认证方式                    | 无                                                        |
| `ssh_exec`     | 在主机上执行一条命令，返回 exit code / stdout / stderr | `host`, `command`, `timeoutMs?`                          |
| `ssh_upload`   | 本地文件 → 远端（scp）                            | `host`, `localPath`, `remotePath`, `mode?`, `timeoutMs?` |
| `ssh_download` | 远端文件 → 本地（scp，自动建本地目录）                    | `host`, `remotePath`, `localPath`, `timeoutMs?`          |

单条流输出默认截断到 `maxOutputBytes`（64 KiB），截断会在结果里明确标出。


## 在设置面板里配置（推荐）

插件声明了 `Config` schema，**设置面板里会用 DSH 自带的表单渲染**（Settings → Plugins → dsh-ssh），
与 YAML patch 是同一份配置的两个视图：表单保存后写回 profile patch 并通过 Loader 实时生效，
不需要重启 `dsh web`，也不需要手改 YAML。

- 表单字段与下面的字段表一一对应，每项都带说明文字；`hosts` 是可增删的列表。
- 保存走 DSH 的 `settings` 服务，带版本号冲突检测：如果同时改了 YAML，保存会提示冲突而不是静默覆盖。
- 密码/口令**不放进配置**，只填 `passwordEnv` 或 `passwordFile` 指向的位置。

## 配置（YAML，等价于表单）

插件行由 bundle 插入，你在 profile 的 patch 层覆盖它的 `config`
（`~/.dsh/profiles/<profile>/cordis.patch.yml`）。**同名覆盖是整段替换**，所以把要保留的
字段一起写；没写的字段会用插件默认值。

```yaml
- id: dsh-ssh
  name: dsh-ssh
  config:
    commandTimeoutMs: 60000      # 命令默认超时
    connectTimeoutSec: 15        # TCP/认证连接超时
    maxOutputBytes: 65536        # 每条流( stdout/stderr )的字节上限
    # sshPath: ssh               # 需要时改绝对路径
    # scpPath: scp
    hosts:
      # 1) 密钥登录（推荐）
      - name: prod
        host: example.com
        port: 22
        username: deploy
        description: 示例：密钥登录的主机
        auth: key
        identityFile: ~/.ssh/id_ed25519
        strictHostKeyChecking: accept-new

      # 2) 密码登录：口令放环境变量，不写进配置文件
      - name: staging
        host: 203.0.113.10                      # RFC 5737 文档专用地址，示例用
        username: root
        auth: password
        passwordEnv: DSH_SSH_STAGING_PASSWORD   # 启动 dsh 前 export
        # passwordFile: ~/.ssh/staging.pass     # 或者放 0600 文件里
```

主机字段：

| 字段 | 默认 | 说明 |
|---|---|---|
| `name` | 必填 | 工具里用的别名；唯一 |
| `host` | 同 `name` | 省略时用别名当主机名，可直接复用 `~/.ssh/config` 里已有的 Host 别名 |
| `port` | `22` | |
| `username` | 交给 ssh 决定 | 省略时用 ssh 自己的解析（含 `~/.ssh/config`） |
| `auth` | `agent` | `agent`（密钥/ssh-agent/ssh_config 全交给 OpenSSH）、`key`、`password` |
| `identityFile` | — | `auth: key` 时的私钥；带上 `IdentitiesOnly=yes` |
| `passwordEnv` / `passwordFile` | — | 密码（`auth: password`）或私钥口令（`auth: key`）的来源；二选一 |
| `strictHostKeyChecking` | `accept-new` | `accept-new` / `yes` / `no` / `ask` |
| `knownHostsFile` | ssh 默认 | 想隔离 known_hosts 时指定 |
| `extraOptions` | `[]` | 原样追加 `-o Key=Value`，例如 `ProxyJump=bastion` |
| `connectTimeoutSec` / `commandTimeoutMs` | 继承全局 | 单主机覆盖 |

全局字段：`sshPath` / `scpPath`（默认 `ssh` / `scp`）、`commandTimeoutMs`、`connectTimeoutSec`、
`maxOutputBytes`、`askpassPath`、`scpMode`（见下）。

### scpMode：远端路径怎么交给 scp

- `sftp`（默认）：**原样传**。OpenSSH 9+ 的 `scp` 默认走 SFTP 协议，远端路径**不经过远端 shell**，
  空格、单引号、`$` 都是普通字符，天然安全。
- `legacy`：按**远端 shell** 规则加引号。只有在对端/客户端确实走旧版 rcp 协议时（给 scp 加了 `-O`，
  或用 OpenSSH < 9 的老客户端）才需要；在现代客户端上设成 `legacy` 会让引号变成文件名的一部分。

> `ssh_exec` 与会话命令走动的是 ssh 命令行，命令串确实由远端 shell 解释；这两条与 `scpMode` 无关。

改完配置后，Host 插件会通过 Loader 的 patch 层热加载；`ssh_hosts` 可以马上验证读到的内容。

## 跨平台

- 只调用 `ssh` / `scp`，参数以 argv 数组传递、**不经过本地 shell**，所以路径带空格、
  引号都不会被本地 shell 拆坏；Windows 上同样不会走 `cmd.exe`。
- Windows 10+ 自带 OpenSSH 客户端（`ssh.exe` / `scp.exe`），无需额外安装。
  密码认证需要 `SSH_ASKPASS` 指向一个可执行 helper：插件会自动生成一个 `.cmd` 包装；
  若你的 Win32-OpenSSH 拒绝执行 `.cmd`，请改用 `auth: key`/`agent`（推荐），
  或用 `askpassPath` 指到你自己的 helper。
- 远端路径按 `scpMode` 处理：默认（`sftp`）**原样传给 scp**，空格/单引号都安全；
  只有 `scpMode: legacy` 才按远端 shell 规则加引号。本地路径会展开 `~` 并转成绝对路径。
- 认证成功时 OpenSSH 也可能往 stderr 写提示（如后量子告警、known_hosts 提示），
  **判失败只看退出码**。

## 安全边界

- 命令以配置用户的权限在远端真实执行，远端没有任何沙箱；`ssh_exec` 可以改远端文件、
  重启服务、装包。
- 密码/passphrase 只经子进程环境变量传给 `ssh`，askpass 脚本本体不含明文；工具返回值
  与错误信息都不包含密钥。
- `strictHostKeyChecking` 默认 `accept-new`（首次信任，之后校验）。要更严就设 `yes`
  并预先把主机密钥写进 `known_hosts`。
- `~/.ssh` 目录不存在时 ssh 会警告「Failed to add the host to the list of known hosts」，
  但仍能连接；想消掉就先 `mkdir -p ~/.ssh && chmod 700 ~/.ssh`。



## 侧边栏 SSH 终端

模型跑 SSH 命令时，右侧栏可以打开一个 **「SSH 终端」** 页面（右侧栏的「+」→ 选择 SSH 终端），
呈现方式接近真的 ssh 登录上去操作：

```
prod $ ssh_exec ls -la /srv
total 12
drwxr-xr-x 2 root root 4096 ...
  ↳ exit 0 · 412ms · 14:12:03
```

- 每行输出按终端习惯滚动：命令行带主机名与 `$` 提示符，stdout 常规色、stderr 红色、结束行灰色（失败/超时标红）
- 数据来自 Host 的同源 SSE 端点 `GET /plugins/dsh-ssh/live`（先发快照再发增量，15 秒心跳）
- 只保留最近 600 行、Host 侧保留最近 400 条事件；都属于展示态，不落盘，`dsh web` 重启后清空
- 样式只用 `--dsw-alias-*` 主题 token，跟随 DSH 主题，不自带皮肤

## 项目结构

```
dsh-ssh/
├── index.js              # Host 入口：name / inject / Config / apply（只做装配）
├── client.js             # Client 入口：侧边栏面板图标 + 实时活动面板
├── src/
│   ├── config.js         # 行配置 -> 规范化后的 hosts + 警告
│   ├── settings.js       # Config schema（设置面板表单的来源）
│   ├── process.js        # OpenSSH 子进程：有界输出、超时、取消、进程组回收
│   ├── connection.js     # 凭据解析 + SSH_ASKPASS helper
│   ├── openssh.js        # ssh/scp 参数构造、主机查找
│   ├── live.js           # 内存态实时活动日志（有界环形缓冲 + 订阅）
│   ├── route.js          # 同源 SSE 端点 /plugins/dsh-ssh/live
│   └── tools/            # 每个面向模型的工具一个文件
│       ├── hosts.js  exec.js  upload.js  download.js
│       └── shared.js     # 参数校验与渲染小工具
├── cordis.patch.yml      # bundle 插入的插件行与默认配置
├── locale/{en,zh}.json   # 插件在插件管理页的标题/描述
└── icon.svg
```

���赖只有 `@deepseek-ai/schemastery`（Config schema 用），Transport 仍是系统 OpenSSH。

## 卸载

```
dsh plugin --profile web remove dsh-ssh
```

或从 profile 的 `cordis.patch.yml` 里删掉 `dsh-ssh` 覆盖项、并从
`package.json` 的 `dsh.profile.bundles` 里移除 `dsh-ssh`。
