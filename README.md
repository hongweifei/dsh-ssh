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

插件自己注册了一个设置页：**设置 → 左侧「SSH 主机」**。每台主机是一张可折叠的卡片，
卡片内分成「连接」和「认证」两组；改完点「保存这台主机」即写回 profile 的
`cordis.patch.yml` 并立即生效（走 DSH 的 `settings` 服务，带版本冲突检测，不会覆盖你在
别处同时做的修改）。

- 面板与 YAML 是**同一份配置**的两个视图，改哪个都行。
- 密码三种给法，面板里都能填：直接填「密码」（明文存进 profile）、填「密码所在环境变量名」、或填「密码文件路径（0600）」。直接填最省事，但会以明文写入 `cordis.patch.yml`。
- **只显示用得上的字段**：选「私钥」只出私钥路径，选「密码」才出口令来源。
- **就地校验**：别名格式、端口范围、私钥是否填写、密码三种给法是否至少有一种，当场标出并禁用保存。
- 主机多了以后，卡片标题行显示别名、地址、认证方式、系统类型和待补项数，折叠起来也能一眼看完。
- 这个设置页属于 Client 半区，**改完 client 代码后需要重启一次 `dsh web`** 才会出现。

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
| `os` | `auto` | 主机系统类型：`auto`（首次使用时自动探测）、`linux`、`macos`（都是 POSIX shell）、`windows`（cmd.exe）；见下 |
| `auth` | `agent` | `agent`（密钥/ssh-agent/ssh_config 全交给 OpenSSH）、`key`、`password` |
| `identityFile` | — | `auth: key` 时的私钥；带上 `IdentitiesOnly=yes` |
| `password` | — | 直接写密码（**明文保存在 profile 的 `cordis.patch.yml`**，图省事用） |
| `passwordEnv` / `passwordFile` | — | 密码（`auth: password`）或私钥口令（`auth: key`）的来源；与 `password` 三选一，优先级 `password` > `passwordEnv` > `passwordFile` |
| `strictHostKeyChecking` | `accept-new` | `accept-new` / `yes` / `no` / `ask` |
| `knownHostsFile` | ssh 默认 | 想隔离 known_hosts 时指定 |
| `extraOptions` | `[]` | 原样追加 `-o Key=Value`，例如 `ProxyJump=bastion` |
| `connectTimeoutSec` / `commandTimeoutMs` | 继承全局 | 单主机覆盖 |

全局字段：`sshPath` / `scpPath`（默认 `ssh` / `scp`）、`commandTimeoutMs`、`connectTimeoutSec`、
`maxOutputBytes`、`askpassPath`、`scpMode`（见下）。

### os：主机系统类型

`os` 有三个取值：

| 取值 | 含义 |
|---|---|
| `auto`（默认） | 首次用到这台主机时自动探测一次，结果记住 |
| `linux` | 明确是 Linux（POSIX shell） |
| `macos` | 明确是 macOS（POSIX shell） |
| `windows` | 明确是 cmd.exe（Windows 自带 OpenSSH 的默认 shell） |

**自动探测**的原理：跑一条 `(uname -s 2>/dev/null || echo NO_UNAME)`。macOS 与 Linux 都有 `uname`，
分别输出 `Darwin` 与 `Linux`；cmd.exe 里没有 `uname`，于是走回退分支输出 `NO_UNAME`
（`2>/dev/null` 在 cmd.exe 里被当成文件名，但 `||` 回退照样执行，探测不会失败）。
三种 shell 下这条命令都是合法语法，输出却各不相同。探测结果按主机缓存，一台主机只探一次；
探测失败时按 `linux` 处理。`ssh_hosts` 会同时返回 `os`（配置值）与 `detectedOs`（已探明的值，
未探时为空）。

`os` 影响两处：

- **命令语法**：`ssh_exec` 的命令原样交给远端 shell，所以 Windows 主机要写 cmd.exe 的命令
  （`dir`、`echo %USERNAME%`、`type a.txt`），Linux 与 macOS 主机写 POSIX 命令（`ls`、`echo $USER`、
  `cat a.txt`）。`&&` 三边都支持。`ssh_hosts` 会返回每台主机的 `os`，据此选语法。
- **权限位**：Windows 没有 POSIX 权限位，`ssh_upload` 传 `mode` 时会跳过 chmod，并在结果里
  如实写明「未应用（该主机没有权限位）」，而不是执行一条必然失败的 `chmod`。Linux 与 macOS 都有
  权限位，`chmod` 照常执行（`--` 是 POSIX 的结束选项标记，GNU coreutils 与 BSD `chmod` 都接受）。

远端路径在 Windows 主机上按 SFTP 路径解释，`C:/Users/name/file.txt`、`C:\Users\name\file.txt`
与相对路径都可用。

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
14:12:03 prod  $ ls -la /srv
               total 12
               drwxr-xr-x 2 root root 4096 ...
14:12:03 prod  ↳ exit 0 · 412ms
```

- 每一行是「时间 + 主机 + 内容」三列，列宽固定，长行换行后仍然对齐在正文列上
- 命令行带主机名与 `$` 提示符，stdout 常规色、stderr 红色、结束行灰色（失败/超时标红）
- 顶部有实时状态点、主机筛选、输出搜索、跟随最新开关，以及复制与清空
- 数据来自 Host 的同源 SSE 端点 `GET /plugins/dsh-ssh/live`（先发快照再发增量，15 秒心跳）
- 只保留最近 800 行、Host 侧保留最近 400 条事件；都属于展示态，不落盘，`dsh web` 重启后清空
- 样式只用 `--dsw-alias-*` 主题 token，跟随 DSH 主题，不自带皮肤

## 项目结构

```
dsh-ssh/
├── index.js              # Host 入口：name / inject / Config / apply（只做装配）
├── client.js             # Client 产物：打包好的单文件，由 build-client.mjs 生成
├── build-client.mjs      # 客户端构建脚本（esbuild，把 src/client/ 打成 client.js）
├── src/
│   ├── config.js         # 行配置 -> 规范化后的 hosts + 警告
│   ├── settings.js       # Config schema（设置面板表单的来源）
│   ├── process.js        # OpenSSH 子进程：有界输出、超时、取消、进程组回收
│   ├── connection.js     # 凭据解析 + SSH_ASKPASS helper
│   ├── openssh.js        # ssh/scp 参数构造、主机查找
│   ├── live.js           # 内存态实时活动日志（有界环形缓冲 + 订阅）
│   ├── route.js          # 同源 SSE 端点 /plugins/dsh-ssh/live
│   ├── tools/            # 每个面向模型的工具一个文件
│   │   ├── hosts.js  exec.js  upload.js  download.js
│   │   └── shared.js     # 参数校验与渲染小工具
│   └── client/           # 客户端源码（打进 client.js）
│       ├── entry.js      # 装配：注册设置页与侧边栏面板
│       ├── settings.js   # 设置页：主机卡片、动态字段、就地校验
│       ├── terminal.js   # 侧边栏终端：时间/主机/内容三列
│       ├── shared.js     # 共用控件：分段控件、输入框、按钮、标签
│       ├── css.js        # 样式（只用 --dsw-alias-* 主题 token）
│       └── jsx.js        # 轻量 JSX 运行时（宿主只提供 react）
├── cordis.patch.yml      # bundle 插入的插件行与默认配置
├── locale/{en,zh}.json   # 插件在插件管理页的标题/描述
└── icon.svg
```

依赖里只有 `@deepseek-ai/schemastery`（Config schema 用），Transport 仍是系统 OpenSSH。
`esbuild` 只在构建客户端时用到，属开发期依赖。

## 卸载

```
dsh plugin --profile web remove dsh-ssh
```

或从 profile 的 `cordis.patch.yml` 里删掉 `dsh-ssh` 覆盖项、并从
`package.json` 的 `dsh.profile.bundles` 里移除 `dsh-ssh`。
