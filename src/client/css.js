/**
 * Styles for the dsh-ssh client pages.
 *
 * Every colour and spacing value comes from the Harness theme tokens
 * (`--dsw-alias-*`), so both pages follow the active theme. The rules are kept
 * in one place so the settings page and the terminal page look like one
 * product rather than two screens that happen to share a plugin.
 */
export const CSS = `
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
`
