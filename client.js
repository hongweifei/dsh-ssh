/**
 * The client bundle of the plugin.
 *
 * The Harness loads client modules as single bundles through its own module
 * loader, so the client code is bundled here. The sources live in
 * `src/client/`; `build-client.mjs` regenerates this file.
 */
window.__ModuleLoader__.load({
  id: 'dsh-ssh',
  factory: (require) => {
    const react = require('react')
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const install = (() => {
  // src/client/css.js
  var CSS = `
.dssRoot{display:flex;flex-direction:column;min-height:0;height:100%;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.dssRoot:focus-visible{outline:none}
/* The settings page is a flex child of the root column, so it needs to be
   allowed to use the full width instead of being squeezed by its content. */
.dssSet{display:flex;flex-direction:column;gap:14px;width:100%;max-width:820px;color:var(--dsw-alias-label-primary)}

/* ---------- shared controls ---------- */
.dssField{display:flex;flex-direction:column;gap:4px;min-width:0}
.dssField>.dssInput{width:100%}
.dssField>.dssSeg{align-self:flex-start}
.dssLabel{font-size:12px;color:var(--dsw-alias-label-tertiary);display:flex;align-items:center;gap:6px;width:100%}
.dssInput{font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;padding:5px 8px;min-width:0;width:100%}
.dssInput::placeholder{color:var(--dsw-alias-label-tertiary)}
.dssInput:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dssInput[aria-invalid=true]{border-color:var(--dsw-alias-state-error-primary)}
.dssHint{font-size:12px;color:var(--dsw-alias-label-tertiary);margin:0}
.dssError{font-size:12px;color:var(--dsw-alias-state-error-primary);margin:0}
.dssOk{font-size:12px;color:var(--dsw-alias-state-success-primary);margin:0}

/* segmented control: the native select is replaced by buttons, so the option
   list is drawn by the page and follows the theme in every browser */
.dssSeg{display:inline-flex;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);flex-wrap:wrap}
.dssSegBtn{font:inherit;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);background:transparent;border:.5px solid transparent;border-radius:6px;padding:3px 9px;cursor:pointer;white-space:nowrap}
.dssSegBtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.dssSegBtn[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-overlay);border-color:var(--dsw-alias-brand-primary)}
.dssSegBtn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}

/* buttons */
.dssBtn{font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 11px;cursor:pointer;white-space:nowrap}
.dssBtn:hover{background:var(--dsw-alias-bg-layer-2)}
.dssBtn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dssBtn:disabled{color:var(--dsw-alias-label-tertiary);cursor:default;background:transparent}
.dssBtnPrimary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.dssBtnPrimary:hover{background:var(--dsw-alias-brand-primary);opacity:.9}
.dssBtnDanger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-border-l2)}
.dssBtnDanger:hover{background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-bg-base)}

/* ---------- settings page ---------- */
.dssSetHead{display:flex;flex-direction:column;gap:6px}
.dssSetTitle{margin:0;font-size:18px;font-weight:600;line-height:24px}
.dssSetIntro{margin:0;font-size:13px;color:var(--dsw-alias-label-tertiary);line-height:20px}
.dssSetList{display:flex;flex-direction:column;gap:10px;margin:0;padding:0;list-style:none}
.dssHost{border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.dssHost[data-invalid=true]{border-color:var(--dsw-alias-state-error-primary)}
.dssHostHead{display:flex;align-items:center;gap:10px;padding:9px 12px;width:100%;background:transparent;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dssHostHead:hover{background:var(--dsw-alias-bg-layer-2)}
.dssHostHead:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dssHostTitle{font-weight:600;flex:none;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dssHostMeta{color:var(--dsw-alias-label-tertiary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.dssHostTags{display:flex;gap:6px;align-items:center;flex:none}
.dssTag{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:1px 8px;white-space:nowrap}
.dssTag[data-tone=ok]{color:var(--dsw-alias-state-success-primary)}
.dssTag[data-tone=warn]{color:var(--dsw-alias-state-warn-primary)}
.dssTag[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
.dssCaret{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .15s ease}
.dssCaret[data-open=true]{transform:rotate(90deg)}
.dssHostBody{display:flex;flex-direction:column;gap:12px;padding:2px 12px 12px;border-top:.5px solid var(--dsw-alias-border-l2)}
.dssGroup{display:flex;flex-direction:column;gap:8px}
.dssGroupTitle{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:8px}
.dssGroupTitle::after{content:"";flex:1;height:.5px;background:var(--dsw-alias-border-l1)}
.dssGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dssGridOne{grid-template-columns:minmax(0,1fr)}
.dssFoot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;position:sticky;bottom:0;background:var(--dsw-alias-bg-base);padding:8px 0}
.dssFootNote{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dssEmpty{display:flex;flex-direction:column;gap:10px;align-items:flex-start;border:.5px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:18px}
.dssEmptyTitle{font-weight:600}
.dssCode{font-family:ui-monospace,SFMono-Regular,"JetBrainsMono Nerd Font",Menlo,Consolas,monospace;font-size:12px;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;padding:8px 10px;white-space:pre-wrap;overflow:auto;color:var(--dsw-alias-label-primary);width:100%}

/* ---------- terminal page ---------- */
.dssTerm{display:flex;flex-direction:column;min-height:0;height:100%}
.dssTermBar{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:.5px solid var(--dsw-alias-border-l2);flex:none;flex-wrap:wrap}
.dssDot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-tertiary);flex:none}
.dssDot[data-state=live]{background:var(--dsw-alias-state-success-primary)}
.dssDot[data-state=closed]{background:var(--dsw-alias-state-error-primary)}
.dssTermCount{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dssTermBody{min-height:0;flex:1;overflow:auto;padding:8px 10px 16px;font-family:ui-monospace,SFMono-Regular,"JetBrainsMono Nerd Font",Menlo,Consolas,monospace;font-size:12px;line-height:18px}
.dssLine{margin:0;display:flex;gap:8px;align-items:baseline}
/* A wrapped line keeps the text column, so the output stays aligned with the
   command that produced it instead of running back to the left edge. */
.dssTime{color:var(--dsw-alias-label-tertiary);flex:none;font-variant-numeric:tabular-nums;width:78px;text-align:right;padding-right:2px}
.dssTermHost{flex:none;font-weight:600;width:48px;max-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:6px}
/* A wrapped line keeps the text column: the first line sits at the column
   edge, the continuation is indented, so the output stays aligned with the
   command that produced it. */
.dssCmd,.dssOut,.dssErr,.dssExit{flex:1;min-width:0;padding-left:14px;text-indent:-14px}
.dssCmd{color:var(--dsw-alias-label-primary);font-weight:600}
.dssOut{color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary))}
.dssErr{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.dssExit{color:var(--dsw-alias-label-tertiary)}
.dssExit[data-ok=false]{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.dssTermEmpty{color:var(--dsw-alias-label-tertiary);margin:0;white-space:pre-wrap}
`;

  // src/client/shared.js
  var factory = null;
  function setJsxFactory(jsxFactory) {
    factory = jsxFactory;
  }
  function jsxOf(props) {
    const resolved = props?.jsx ?? factory;
    if (typeof resolved !== "function") {
      throw new Error("dsh-ssh client: the JSX factory was not provided");
    }
    return resolved;
  }
  function TextField(props) {
    const jsx2 = jsxOf(props);
    return jsx2("label", {
      className: "dssField",
      children: [
        jsx2("span", { className: "dssLabel", children: props.label }),
        jsx2("input", {
          className: "dssInput",
          type: props.type ?? "text",
          value: props.value ?? "",
          placeholder: props.placeholder ?? "",
          "aria-invalid": props.invalid === true ? "true" : void 0,
          onChange: (event) => props.onChange(event.target.value)
        }),
        props.hint === void 0 ? null : jsx2("span", { className: "dssHint", children: props.hint })
      ]
    });
  }
  function Segmented(props) {
    const jsx2 = jsxOf(props);
    return jsx2("div", {
      className: "dssSeg",
      role: "group",
      "aria-label": props.label,
      children: props.options.map(
        (option) => jsx2("button", {
          key: option.value,
          type: "button",
          className: "dssSegBtn",
          "aria-pressed": option.value === props.value ? "true" : "false",
          title: option.title,
          onClick: () => props.onChange(option.value),
          children: option.label
        })
      )
    });
  }
  function Button(props) {
    const jsx2 = jsxOf(props);
    const className = [
      "dssBtn",
      props.variant === "primary" ? "dssBtnPrimary" : "",
      props.variant === "danger" ? "dssBtnDanger" : ""
    ].filter(Boolean).join(" ");
    return jsx2("button", {
      type: "button",
      className,
      disabled: props.disabled === true,
      onClick: props.onClick,
      title: props.title,
      children: props.children
    });
  }
  function Tag(props) {
    const jsx2 = jsxOf(props);
    return jsx2("span", { className: "dssTag", "data-tone": props.tone, children: props.children });
  }
  function Caret(props) {
    const jsx2 = jsxOf(props);
    return jsx2("svg", {
      className: "dssCaret",
      "data-open": props.open === true ? "true" : "false",
      width: 12,
      height: 12,
      viewBox: "0 0 16 16",
      fill: "none",
      "aria-hidden": "true",
      children: jsx2("path", {
        d: "M6 3.5 10.5 8 6 12.5",
        stroke: "currentColor",
        strokeWidth: 1.6,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      })
    });
  }
  function Group(props) {
    const jsx2 = jsxOf(props);
    return jsx2("section", {
      className: "dssGroup",
      children: [
        jsx2("h4", { className: "dssGroupTitle", children: props.title }),
        jsx2("div", { className: "dssGrid", children: props.children })
      ]
    });
  }

  // src/client/settings.js
  var AUTH_OPTIONS = [
    { value: "agent", label: "\u81EA\u52A8", title: "\u4EA4\u7ED9 OpenSSH\uFF1Assh-agent\u3001~/.ssh/config \u4E0E\u9ED8\u8BA4\u5BC6\u94A5" },
    { value: "key", label: "\u79C1\u94A5", title: "\u4F7F\u7528\u6307\u5B9A\u7684\u79C1\u94A5\u6587\u4EF6" },
    { value: "password", label: "\u5BC6\u7801", title: "\u4F7F\u7528\u5BC6\u7801\u6216\u79C1\u94A5\u53E3\u4EE4" }
  ];
  var OS_OPTIONS = [
    { value: "auto", label: "\u81EA\u52A8\u68C0\u6D4B", title: "\u9996\u6B21\u8FDE\u63A5\u65F6\u63A2\u6D4B\u4E00\u6B21" },
    { value: "linux", label: "Linux", title: "POSIX shell" },
    { value: "macos", label: "macOS", title: "POSIX shell" },
    { value: "windows", label: "Windows", title: "cmd.exe" }
  ];
  var SECRET_OPTIONS = [
    { value: "inline", label: "\u76F4\u63A5\u586B", title: "\u660E\u6587\u4FDD\u5B58\u5728 profile \u7684 cordis.patch.yml" },
    { value: "env", label: "\u73AF\u5883\u53D8\u91CF", title: "\u4ECE\u73AF\u5883\u53D8\u91CF\u8BFB\u53D6\u53E3\u4EE4" },
    { value: "file", label: "\u5BC6\u7801\u6587\u4EF6", title: "\u4ECE 0600 \u6743\u9650\u7684\u6587\u4EF6\u8BFB\u53D6\u53E3\u4EE4" }
  ];
  function emptyHost() {
    return {
      name: "",
      host: "",
      port: 22,
      username: "",
      auth: "agent",
      os: "auto",
      identityFile: "",
      password: "",
      passwordEnv: "",
      passwordFile: ""
    };
  }
  var HOST_FIELDS = Object.keys(emptyHost());
  function hostRow(host) {
    const row = emptyHost();
    for (const field of HOST_FIELDS) {
      if (host[field] !== void 0 && host[field] !== null) row[field] = host[field];
    }
    return row;
  }
  function validateHost(row) {
    const problems = [];
    if (row.name.trim() === "") problems.push("\u7F3A\u5C11\u522B\u540D");
    else if (!/^[A-Za-z0-9._-]+$/.test(row.name.trim())) {
      problems.push("\u522B\u540D\u53EA\u80FD\u5305\u542B\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u70B9\u3001\u4E0B\u5212\u7EBF\u548C\u8FDE\u5B57\u7B26");
    }
    const port = Number(row.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push("\u7AEF\u53E3\u9700\u5728 1\u201365535 \u4E4B\u95F4");
    if (row.auth === "key" && row.identityFile.trim() === "") problems.push("\u79C1\u94A5\u65B9\u5F0F\u9700\u8981\u586B\u5199\u79C1\u94A5\u8DEF\u5F84");
    if (row.auth === "password") {
      const hasInline = row.password !== "" && row.password !== void 0;
      const hasEnv = row.passwordEnv.trim() !== "";
      const hasFile = row.passwordFile.trim() !== "";
      if (!hasInline && !hasEnv && !hasFile) problems.push("\u5BC6\u7801\u65B9\u5F0F\u9700\u8981\u586B\u5199\u5BC6\u7801\u3001\u73AF\u5883\u53D8\u91CF\u540D\u6216\u5BC6\u7801\u6587\u4EF6\u8DEF\u5F84");
    }
    return problems;
  }
  function secretSource(row) {
    if (row.password !== "" && row.password !== void 0) return "inline";
    if (row.passwordEnv.trim() !== "") return "env";
    if (row.passwordFile.trim() !== "") return "file";
    return "inline";
  }
  function hostSummary(row) {
    const address = row.host.trim() === "" ? row.name.trim() : row.host.trim();
    const user = row.username.trim() === "" ? "" : `${row.username.trim()}@`;
    return `${user}${address}:${row.port}`;
  }
  function createSettingsPage(jsx2, jsxs2, react) {
    function HostCard(props) {
      const { row, index, state, actions } = props;
      const problems = validateHost(row);
      const open = state.open.includes(index);
      const source = secretSource(row);
      const edit = (field) => (value) => actions.edit(index, field, value);
      const setSecretSource = (next) => {
        if (next === "inline") actions.edit(index, "passwordEnv", "");
        if (next === "env") {
          actions.edit(index, "password", "");
          actions.edit(index, "passwordFile", "");
        }
        if (next === "file") {
          actions.edit(index, "password", "");
          actions.edit(index, "passwordEnv", "");
        }
      };
      return jsxs2("li", {
        className: "dssHost",
        "data-invalid": problems.length > 0 ? "true" : void 0,
        children: [
          jsxs2("button", {
            type: "button",
            className: "dssHostHead",
            "aria-expanded": open ? "true" : "false",
            onClick: () => actions.toggle(index),
            children: [
              jsx2(Caret, { jsx: jsx2, open }),
              jsx2("span", { className: "dssHostTitle", children: row.name.trim() === "" ? "\u672A\u547D\u540D\u4E3B\u673A" : row.name.trim() }),
              jsx2("span", { className: "dssHostMeta", children: hostSummary(row) }),
              jsxs2("span", {
                className: "dssHostTags",
                children: [
                  jsx2(Tag, { jsx: jsx2, tone: "ok", children: row.auth === "key" ? "\u79C1\u94A5" : row.auth === "password" ? "\u5BC6\u7801" : "\u81EA\u52A8" }),
                  jsx2(Tag, {
                    jsx: jsx2,
                    tone: row.os === "auto" ? void 0 : "ok",
                    children: row.os === "auto" ? "\u7CFB\u7EDF\u81EA\u52A8\u68C0\u6D4B" : row.os === "windows" ? "Windows" : row.os === "macos" ? "macOS" : "Linux"
                  }),
                  problems.length > 0 ? jsx2(Tag, { jsx: jsx2, tone: "error", children: `${problems.length} \u9879\u5F85\u8865` }) : null
                ]
              })
            ]
          }),
          open ? jsxs2("div", {
            className: "dssHostBody",
            children: [
              jsx2(Group, {
                jsx: jsx2,
                title: "\u8FDE\u63A5",
                children: [
                  jsx2(TextField, {
                    jsx: jsx2,
                    label: "\u522B\u540D",
                    value: row.name,
                    placeholder: "prod",
                    hint: "\u5DE5\u5177\u8C03\u7528\u65F6\u7528\u5B83\u6307\u5B9A\u4E3B\u673A\uFF0C\u540C\u4E00\u914D\u7F6E\u5185\u552F\u4E00",
                    invalid: row.name.trim() === "",
                    onChange: edit("name")
                  }),
                  jsx2(TextField, {
                    jsx: jsx2,
                    label: "\u5730\u5740",
                    value: row.host,
                    placeholder: "example.com",
                    hint: "\u7559\u7A7A\u5219\u7528\u522B\u540D\u672C\u8EAB",
                    onChange: edit("host")
                  }),
                  jsx2(TextField, {
                    jsx: jsx2,
                    label: "\u7AEF\u53E3",
                    type: "number",
                    value: row.port,
                    invalid: !Number.isInteger(Number(row.port)) || Number(row.port) < 1 || Number(row.port) > 65535,
                    onChange: edit("port")
                  }),
                  jsx2(TextField, {
                    jsx: jsx2,
                    label: "\u767B\u5F55\u7528\u6237",
                    value: row.username,
                    placeholder: "root",
                    onChange: edit("username")
                  }),
                  jsx2("div", {
                    className: "dssField",
                    children: [
                      jsx2("span", { className: "dssLabel", children: "\u7CFB\u7EDF\u7C7B\u578B" }),
                      jsx2(Segmented, {
                        jsx: jsx2,
                        label: "\u7CFB\u7EDF\u7C7B\u578B",
                        value: row.os,
                        options: OS_OPTIONS,
                        onChange: edit("os")
                      })
                    ]
                  })
                ]
              }),
              jsx2(Group, {
                jsx: jsx2,
                title: "\u8BA4\u8BC1",
                children: [
                  jsx2("div", {
                    className: "dssField",
                    children: [
                      jsx2("span", { className: "dssLabel", children: "\u65B9\u5F0F" }),
                      jsx2(Segmented, {
                        jsx: jsx2,
                        label: "\u8BA4\u8BC1\u65B9\u5F0F",
                        value: row.auth,
                        options: AUTH_OPTIONS,
                        onChange: edit("auth")
                      })
                    ]
                  }),
                  row.auth === "key" ? jsx2(TextField, {
                    jsx: jsx2,
                    label: "\u79C1\u94A5\u8DEF\u5F84",
                    value: row.identityFile,
                    placeholder: "~/.ssh/id_ed25519",
                    hint: "\u53EA\u5BF9\u8BE5\u4E3B\u673A\u4F7F\u7528\u8FD9\u628A\u5BC6\u94A5",
                    onChange: edit("identityFile")
                  }) : null,
                  row.auth === "password" ? jsxs2("div", {
                    className: "dssField",
                    children: [
                      jsx2("span", { className: "dssLabel", children: "\u53E3\u4EE4\u6765\u6E90" }),
                      jsx2(Segmented, {
                        jsx: jsx2,
                        label: "\u53E3\u4EE4\u6765\u6E90",
                        value: source,
                        options: SECRET_OPTIONS,
                        onChange: setSecretSource
                      }),
                      source === "inline" ? jsx2(TextField, {
                        jsx: jsx2,
                        label: "\u5BC6\u7801",
                        type: "password",
                        value: row.password,
                        hint: "\u660E\u6587\u4FDD\u5B58\u5728 cordis.patch.yml",
                        onChange: edit("password")
                      }) : null,
                      source === "env" ? jsx2(TextField, {
                        jsx: jsx2,
                        label: "\u73AF\u5883\u53D8\u91CF\u540D",
                        value: row.passwordEnv,
                        placeholder: "DSH_SSH_PROD_PASSWORD",
                        hint: "\u8BE5\u53D8\u91CF\u987B\u5B58\u5728\u4E8E dsh web \u8FDB\u7A0B\u7684\u73AF\u5883\u4E2D",
                        onChange: edit("passwordEnv")
                      }) : null,
                      source === "file" ? jsx2(TextField, {
                        jsx: jsx2,
                        label: "\u5BC6\u7801\u6587\u4EF6",
                        value: row.passwordFile,
                        placeholder: "~/.ssh/prod.pass",
                        hint: "\u6587\u4EF6\u6743\u9650\u5EFA\u8BAE 0600",
                        onChange: edit("passwordFile")
                      }) : null
                    ]
                  }) : null
                ]
              }),
              problems.length > 0 ? jsx2("p", { className: "dssError", children: problems.join("\uFF1B") }) : null,
              jsxs2("div", {
                className: "dssFoot",
                children: [
                  jsx2(Button, {
                    jsx: jsx2,
                    variant: "primary",
                    disabled: state.saving || problems.length > 0,
                    onClick: () => void actions.save(index),
                    children: state.savedIndex === index ? "\u5DF2\u4FDD\u5B58" : "\u4FDD\u5B58\u8FD9\u53F0\u4E3B\u673A"
                  }),
                  jsx2(Button, {
                    jsx: jsx2,
                    variant: "danger",
                    disabled: state.saving,
                    onClick: () => void actions.remove(index),
                    children: "\u5220\u9664"
                  }),
                  jsx2("span", {
                    className: "dssFootNote",
                    children: state.message === "" ? "\u4FDD\u5B58\u540E\u7ACB\u5373\u751F\u6548\uFF0C\u65E0\u9700\u91CD\u542F" : state.message
                  })
                ]
              })
            ]
          }) : null
        ]
      });
    }
    return function SshHostsSettings(props) {
      const initial = props.initial;
      const [state, setState] = react.useState(
        initial === void 0 ? {
          status: "loading",
          rows: [],
          revision: void 0,
          open: [],
          saving: false,
          savedIndex: -1,
          message: "",
          error: ""
        } : {
          status: "ready",
          rows: initial.hosts.map(hostRow),
          revision: initial.revision,
          open: initial.open ?? [],
          saving: false,
          savedIndex: -1,
          message: "",
          error: ""
        }
      );
      const reload = react.useCallback(async () => {
        try {
          const loaded = await props.load();
          setState((previous) => ({
            ...previous,
            status: "ready",
            rows: loaded.hosts.map(hostRow),
            revision: loaded.revision,
            error: ""
          }));
        } catch (error) {
          setState((previous) => ({
            ...previous,
            status: "error",
            error: error instanceof Error ? error.message : String(error)
          }));
        }
      }, [props]);
      react.useEffect(() => {
        void reload();
      }, [reload]);
      const actions = {
        edit: (index, field, value) => setState((previous) => ({
          ...previous,
          rows: previous.rows.map((row, position) => position === index ? { ...row, [field]: value } : row),
          savedIndex: -1,
          message: ""
        })),
        toggle: (index) => setState((previous) => ({
          ...previous,
          open: previous.open.includes(index) ? previous.open.filter((entry) => entry !== index) : [...previous.open, index]
        })),
        remove: async (index) => {
          setState((previous) => ({ ...previous, saving: true, message: "", error: "" }));
          try {
            const rows = state.rows.filter((_, position) => position !== index).map(toStoredHost);
            await props.save(rows, state.revision);
            setState((previous) => ({
              ...previous,
              saving: false,
              open: previous.open.filter((entry) => entry !== index).map((entry) => entry > index ? entry - 1 : entry),
              message: "\u5DF2\u5220\u9664"
            }));
            await reload();
          } catch (error) {
            setState((previous) => ({
              ...previous,
              saving: false,
              error: error instanceof Error ? error.message : String(error)
            }));
          }
        },
        save: async (index) => {
          setState((previous) => ({ ...previous, saving: true, message: "", error: "" }));
          try {
            const rows = state.rows.map(toStoredHost);
            await props.save(rows, state.revision);
            setState((previous) => ({ ...previous, saving: false, savedIndex: index, message: "\u5DF2\u4FDD\u5B58\uFF0C\u914D\u7F6E\u5DF2\u751F\u6548" }));
            await reload();
          } catch (error) {
            setState((previous) => ({
              ...previous,
              saving: false,
              error: error instanceof Error ? error.message : String(error)
            }));
          }
        }
      };
      if (state.status === "loading") {
        return jsx2("div", { className: "dssRoot", children: jsx2("p", { className: "dssHint", children: "\u8BFB\u53D6\u914D\u7F6E\u2026" }) });
      }
      if (state.status === "error") {
        return jsx2("div", {
          className: "dssRoot",
          children: jsx2("p", { className: "dssError", children: `\u8BFB\u53D6\u5931\u8D25\uFF1A${state.error}` })
        });
      }
      return jsxs2("div", {
        className: "dssRoot",
        children: [
          jsxs2("div", {
            className: "dssSet",
            children: [
              jsxs2("div", {
                className: "dssSetHead",
                children: [
                  jsx2("h2", { className: "dssSetTitle", children: "SSH \u4E3B\u673A" }),
                  jsx2("p", {
                    className: "dssSetIntro",
                    children: "\u6A21\u578B\u53EA\u80FD\u8FDE\u63A5\u8FD9\u91CC\u5217\u51FA\u7684\u4E3B\u673A\uFF0C\u6309\u522B\u540D\u8C03\u7528\u3002\u6539\u5B8C\u70B9\u300C\u4FDD\u5B58\u8FD9\u53F0\u4E3B\u673A\u300D\u5373\u751F\u6548\uFF0C\u65E0\u9700\u91CD\u542F\uFF1B\u4E5F\u53EF\u4EE5\u76F4\u63A5\u7F16\u8F91 profile \u7684 cordis.patch.yml\uFF0C\u4E24\u5904\u662F\u540C\u4E00\u4EFD\u914D\u7F6E\u3002"
                  })
                ]
              }),
              state.rows.length === 0 ? jsxs2("div", {
                className: "dssEmpty",
                children: [
                  jsx2("p", { className: "dssEmptyTitle", children: "\u8FD8\u6CA1\u6709\u4E3B\u673A" }),
                  jsx2("p", { className: "dssHint", children: "\u70B9\u4E0B\u9762\u300C\u6DFB\u52A0\u4E3B\u673A\u300D\u586B\u5199\u522B\u540D\u3001\u5730\u5740\u4E0E\u8BA4\u8BC1\u65B9\u5F0F\uFF0C\u4FDD\u5B58\u540E\u5373\u53EF\u7528 ssh_exec \u8C03\u7528\u3002" }),
                  jsx2(Button, {
                    jsx: jsx2,
                    variant: "primary",
                    onClick: () => setState((previous) => ({
                      ...previous,
                      rows: [...previous.rows, emptyHost()],
                      open: [...previous.open, previous.rows.length]
                    })),
                    children: "\u6DFB\u52A0\u4E3B\u673A"
                  })
                ]
              }) : jsxs2("ul", {
                className: "dssSetList",
                children: state.rows.map(
                  (row, index) => jsx2(HostCard, { jsxs: jsxs2, row, index, state, actions }, index)
                )
              }),
              state.rows.length > 0 ? jsx2(Button, {
                jsx: jsx2,
                onClick: () => setState((previous) => ({
                  ...previous,
                  rows: [...previous.rows, emptyHost()],
                  open: [...previous.open, previous.rows.length]
                })),
                children: "\u6DFB\u52A0\u4E3B\u673A"
              }) : null,
              state.error === "" ? null : jsx2("p", { className: "dssError", children: state.error })
            ]
          })
        ]
      });
    };
  }
  function toStoredHost(row) {
    const stored = {};
    for (const field of HOST_FIELDS) {
      const value = row[field];
      if (value === "" || value === void 0) continue;
      stored[field] = field === "port" ? Number(value) : value;
    }
    return stored;
  }

  // src/client/terminal.js
  var MAX_ROWS = 800;
  function rowsOf(event) {
    const date = new Date(event.at);
    const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
    const host = String(event.host ?? "remote");
    if (event.kind === "start") {
      const tool = String(event.tool ?? "");
      const verb = tool === "ssh_upload" ? "scp \u25B8 " : tool === "ssh_download" ? "scp \u25C2 " : "";
      return [{ time, host, text: `$ ${verb}${String(event.detail ?? "")}`, kind: "cmd" }];
    }
    if (event.kind === "end") {
      const ok = event.failed !== true && event.exitCode === 0;
      const status = event.failed === true ? "failed" : `exit ${event.exitCode}${event.timedOut === true ? " (timeout)" : ""}`;
      const rows = [
        { time, host, text: `\u21B3 ${status} \xB7 ${event.durationMs}ms`, kind: "exit", ok }
      ];
      if (typeof event.text === "string" && event.text !== "") {
        for (const line of event.text.split("\n").slice(0, 20)) {
          rows.push({ time: "", host: "", text: line, kind: "err" });
        }
      }
      return rows;
    }
    const text = String(event.text ?? "");
    if (text === "") return [];
    const clean = text.endsWith("\n") ? text.slice(0, -1) : text;
    const kind = event.stream === "stderr" ? "err" : "out";
    return clean.split("\n").map((line) => ({ time: "", host: "", text: line, kind }));
  }
  function alignRows(rows) {
    let time = "";
    let host = "";
    return rows.map((row) => {
      if (row.time !== "") time = row.time;
      if (row.host !== "") host = row.host;
      return { ...row, gutterTime: time, gutterHost: host };
    });
  }
  function createTerminalPage(jsx2, jsxs2, react) {
    return function SshTerminal(props) {
      const [rows, setRows] = react.useState(
        props.events === void 0 ? [] : props.events.flatMap(rowsOf)
      );
      const [state, setState] = react.useState(props.events === void 0 ? "connecting" : "live");
      const [filter, setFilter] = react.useState("");
      const [query, setQuery] = react.useState("");
      const [follow, setFollow] = react.useState(true);
      const [cleared, setCleared] = react.useState(0);
      const bodyRef = react.useRef(null);
      react.useEffect(() => {
        if (typeof EventSource === "undefined") {
          setState("unsupported");
          return void 0;
        }
        const source = new EventSource("/plugins/dsh-ssh/live");
        source.onopen = () => setState("live");
        source.onerror = () => setState("closed");
        source.onmessage = (message) => {
          let event;
          try {
            event = JSON.parse(message.data);
          } catch {
            return;
          }
          const fresh = rowsOf(event);
          if (fresh.length === 0) return;
          setRows((previous) => {
            const next = previous.concat(fresh);
            return next.length > MAX_ROWS ? next.slice(next.length - MAX_ROWS) : next;
          });
        };
        return () => source.close();
      }, []);
      react.useEffect(() => {
        const body = bodyRef.current;
        if (body !== null && follow) body.scrollTop = body.scrollHeight;
      }, [rows, follow]);
      const hosts = Array.from(new Set(rows.map((row) => row.host).filter(Boolean))).sort();
      const visible = alignRows(
        rows.filter((row) => {
          if (filter !== "" && row.host !== "" && row.host !== filter) return false;
          if (query !== "" && !row.text.toLowerCase().includes(query.toLowerCase())) return false;
          return true;
        })
      );
      const errors = rows.filter((row) => row.kind === "err" && row.ok !== true).length;
      const copyAll = () => {
        const text = visible.map((row) => row.text).join("\n");
        void navigator.clipboard?.writeText(text);
      };
      return jsxs2("section", {
        className: "dssTerm",
        children: [
          jsxs2("header", {
            className: "dssTermBar",
            children: [
              jsx2("span", { className: "dssDot", "data-state": state }),
              jsx2("span", {
                className: "dssTermCount",
                children: state === "live" ? "\u5B9E\u65F6" : state === "closed" ? "\u5DF2\u65AD\u5F00\uFF0C\u91CD\u8BD5\u4E2D" : state === "unsupported" ? "\u6B64\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u5B9E\u65F6\u6D41" : "\u8FDE\u63A5\u4E2D\u2026"
              }),
              jsx2("span", { className: "dssTermCount", children: `\xB7 ${visible.length} \u884C` }),
              errors > 0 ? jsx2("span", { className: "dssTermCount", children: `\xB7 ${errors} \u6761\u9519\u8BEF` }) : null,
              jsxs2("div", {
                className: "dssTermBar",
                style: { marginLeft: "auto", gap: "6px" },
                children: [
                  hosts.length > 0 ? jsx2("select", {
                    className: "dssInput",
                    style: { width: "auto", colorScheme: "dark" },
                    value: filter,
                    onChange: (event) => setFilter(event.target.value),
                    children: [
                      jsx2("option", { value: "", children: "\u5168\u90E8\u4E3B\u673A" }),
                      ...hosts.map((host) => jsx2("option", { value: host, children: host }, host))
                    ]
                  }) : null,
                  jsx2("input", {
                    className: "dssInput",
                    style: { width: "140px" },
                    type: "search",
                    value: query,
                    placeholder: "\u641C\u7D22\u8F93\u51FA",
                    onChange: (event) => setQuery(event.target.value)
                  }),
                  jsx2("button", {
                    type: "button",
                    className: "dssBtn",
                    "aria-pressed": follow ? "true" : "false",
                    onClick: () => setFollow((previous) => !previous),
                    children: follow ? "\u8DDF\u968F\u6700\u65B0" : "\u5DF2\u6682\u505C\u8DDF\u968F"
                  }),
                  jsx2("button", {
                    type: "button",
                    className: "dssBtn",
                    onClick: copyAll,
                    children: "\u590D\u5236"
                  }),
                  jsx2("button", {
                    type: "button",
                    className: "dssBtn",
                    onClick: () => {
                      setRows([]);
                      setCleared((count) => count + 1);
                    },
                    children: "\u6E05\u7A7A"
                  })
                ]
              })
            ]
          }),
          jsx2("div", {
            className: "dssTermBody",
            ref: bodyRef,
            children: visible.length === 0 ? jsx2("p", {
              className: "dssTermEmpty",
              children: rows.length === 0 ? "\u7B49\u5F85 SSH \u6D3B\u52A8\u2026\n\u6A21\u578B\u8C03\u7528 ssh_exec / ssh_upload / ssh_download \u65F6\uFF0C\u8FD9\u91CC\u4F1A\u50CF\u771F\u5B9E\u7EC8\u7AEF\u4E00\u6837\u9010\u884C\u663E\u793A\u547D\u4EE4\u4E0E\u8F93\u51FA\u3002" : "\u6CA1\u6709\u7B26\u5408\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u7684\u884C\u3002"
            }) : visible.map(
              (row, index) => jsx2(
                "p",
                {
                  className: "dssLine",
                  children: [
                    jsx2("span", { className: "dssTime", children: row.gutterTime ?? row.time }),
                    jsx2("span", { className: "dssTermHost", children: row.gutterHost ?? row.host }),
                    jsx2("span", {
                      className: row.kind === "cmd" ? "dssCmd" : row.kind === "err" ? "dssErr" : row.kind === "exit" ? "dssExit" : "dssOut",
                      "data-ok": row.kind === "exit" ? String(row.ok !== false) : void 0,
                      children: row.text
                    })
                  ]
                },
                index
              )
            )
          })
        ]
      });
    };
  }

  // src/client/entry.js
  function install(react, jsx2, jsxs2) {
    setJsxFactory(jsx2);
    const KIND = "ssh-live";
    const tagId = "dsh-ssh/ui.css";
    if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css="${tagId}"]`) === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-ssh";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }
    const SshHostsSettings = createSettingsPage(jsx2, jsxs2, react);
    const SshTerminal = createTerminalPage(jsx2, jsxs2, react);
    function SshTerminalTitle() {
      return jsx2("span", { children: "SSH \u7EC8\u7AEF" });
    }
    function GuideIcon() {
      return jsx2("svg", {
        width: 16,
        height: 16,
        viewBox: "0 0 16 16",
        fill: "none",
        "aria-hidden": "true",
        children: [
          jsx2("rect", { key: "rect", x: 1.2, y: 2.2, width: 13.6, height: 11.6, rx: 3, stroke: "currentColor", strokeWidth: 1.2 }),
          jsx2("path", { key: "prompt", d: "M4.6 6.2 6.6 8l-2 1.8", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" }),
          jsx2("path", { key: "line", d: "M8.4 10h3", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" })
        ]
      });
    }
    function pickNamespace(view) {
      const rows = view?.namespaces ?? [];
      return rows.find((row) => row.ns === "dsh-ssh") ?? rows.find((row) => typeof row.ns === "string" && row.ns.endsWith("dsh-ssh")) ?? void 0;
    }
    function apply(ctx) {
      const describeRow = async () => {
        const response = await ctx.remote.settings.describe();
        if (response?.ok !== true) throw new Error(response?.error?.message ?? "\u8BFB\u53D6\u8BBE\u7F6E\u5931\u8D25");
        const row = pickNamespace(response.value);
        if (row === void 0) throw new Error("\u6CA1\u6709\u627E\u5230 dsh-ssh \u7684\u914D\u7F6E\u9879\uFF08\u63D2\u4EF6\u53EF\u80FD\u672A\u751F\u6548\uFF09");
        return row;
      };
      const load = async () => {
        const row = await describeRow();
        return {
          hosts: Array.isArray(row.value?.hosts) ? row.value.hosts : [],
          revision: row.revision,
          writable: row.applies === "live"
        };
      };
      const save = async (hosts, revision) => {
        const row = await describeRow();
        const written = await ctx.remote.settings.update(row.ns, { hosts }, revision ?? row.revision);
        if (written?.ok !== true) throw new Error(written?.error?.message ?? "\u4FDD\u5B58\u5931\u8D25");
      };
      ctx.effect(
        () => ctx.slots.inject(
          "settings.section",
          () => ctx.slots.register(
            {
              name: "settings.section",
              id: "ssh-hosts",
              order: 30,
              label: () => "SSH \u4E3B\u673A",
              locale: "settings.ssh-hosts",
              inject: () => ({ load, save })
            },
            SshHostsSettings
          )
        ),
        "dsh-ssh.settings-page"
      );
      ctx.effect(
        () => ctx.sidebarRightTabs.register({
          id: "dsh-ssh",
          kind: KIND,
          multiple: false,
          title: () => "SSH \u7EC8\u7AEF",
          guide: [
            {
              id: "ssh-live",
              order: 30,
              title: () => "SSH \u7EC8\u7AEF",
              description: () => "\u5B9E\u65F6\u67E5\u770B\u6A21\u578B\u5728\u8FDC\u7A0B\u4E3B\u673A\u4E0A\u6267\u884C\u7684\u547D\u4EE4\u4E0E\u8F93\u51FA",
              icon: GuideIcon
            }
          ]
        }),
        "dsh-ssh.tab-kind"
      );
      ctx.effect(
        () => ctx.slots.inject(
          "sidebar.right.pane.tab",
          () => ctx.slots.register({ name: "sidebar.right.pane.tab", key: KIND }, SshTerminal)
        ),
        "dsh-ssh.tab-body"
      );
      ctx.effect(
        () => ctx.slots.inject(
          "sidebar.right.pane.tab.title",
          () => ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: KIND }, SshTerminalTitle)
        ),
        "dsh-ssh.tab-title"
      );
    }
    return {
      apply,
      inject: ["slots", "remote", "remote.settings", "sidebarRight", "sidebarRightTabs"],
      // The page components, exposed so a render harness can mount them.
      pages: { SshHostsSettings, SshTerminal }
    };
  }
})();

    const plugin = install(react, jsx, jsxs)
    exports.apply = plugin.apply
    exports.inject = plugin.inject
    exports.pages = plugin.pages
    return module.exports
  },
})
