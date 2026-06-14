/* @ds-bundle: {"format":3,"namespace":"AnchorDesignSystem_997765","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"SegmentedControl","sourcePath":"components/core/SegmentedControl.jsx"},{"name":"Switch","sourcePath":"components/core/Switch.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"AnchorPin","sourcePath":"components/map/AnchorPin.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"7c9550ec9824","components/core/Badge.jsx":"ebb178ce75f4","components/core/Button.jsx":"ffe177848eec","components/core/Card.jsx":"daa8751d43e6","components/core/IconButton.jsx":"411b4411e760","components/core/Input.jsx":"b5351295239a","components/core/SegmentedControl.jsx":"ee0f8cbb35a5","components/core/Switch.jsx":"83a494b00a40","components/core/Tag.jsx":"c21a1fda4c85","components/map/AnchorPin.jsx":"67ad303dc191","ui_kits/app/Map.jsx":"b402532d9a40","ui_kits/app/Shell.jsx":"1609b2b53692","ui_kits/app/data.js":"43d876f733ce","ui_kits/app/icons.js":"6d59a2497f37"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.AnchorDesignSystem_997765 = window.AnchorDesignSystem_997765 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.an-avatar{
  display:inline-flex; align-items:center; justify-content:center;
  border-radius:50%; overflow:hidden; flex:none; position:relative;
  font-family:var(--font-text); font-weight:600; color:#fff;
  background:var(--gradient-violet); user-select:none;
}
.an-avatar img{ width:100%; height:100%; object-fit:cover; display:block; }
.an-avatar--ring{ box-shadow:0 0 0 2px var(--paper-0), 0 0 0 4px var(--violet-200); }
.an-avatar--xs{ width:24px; height:24px; font-size:10px; }
.an-avatar--sm{ width:32px; height:32px; font-size:12px; }
.an-avatar--md{ width:40px; height:40px; font-size:15px; }
.an-avatar--lg{ width:56px; height:56px; font-size:20px; }
.an-avatar--xl{ width:72px; height:72px; font-size:26px; }
.an-avatar__status{
  position:absolute; right:-1px; bottom:-1px; width:28%; height:28%;
  min-width:8px; min-height:8px; border-radius:50%;
  background:var(--success); box-shadow:0 0 0 2px var(--paper-0);
}
`;
if (typeof document !== 'undefined' && !document.getElementById('an-avatar-css')) {
  const s = document.createElement('style');
  s.id = 'an-avatar-css';
  s.textContent = css;
  document.head.appendChild(s);
}
const GRADIENTS = ['var(--gradient-violet)', 'linear-gradient(135deg,#FF9E5E,#F857A6)', 'linear-gradient(135deg,#8B72FB,#F857A6)', 'linear-gradient(135deg,#14A06E,#8B72FB)'];
function initials(name) {
  if (!name) return '';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function Avatar({
  src = null,
  name = '',
  size = 'md',
  ring = false,
  status = false,
  className = '',
  ...rest
}) {
  const cls = ['an-avatar', `an-avatar--${size}`, ring ? 'an-avatar--ring' : '', className].filter(Boolean).join(' ');
  const idx = (name ? name.charCodeAt(0) : 0) % GRADIENTS.length;
  const style = src ? undefined : {
    background: GRADIENTS[idx]
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    style: style
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name
  }) : initials(name), status ? /*#__PURE__*/React.createElement("span", {
    className: "an-avatar__status"
  }) : null);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.an-badge{
  display:inline-flex; align-items:center; gap:5px;
  font-family:var(--font-text); font-weight:600; line-height:1;
  border-radius:var(--radius-pill); white-space:nowrap;
  font-size:12px; padding:5px 10px;
}
.an-badge--sm{ font-size:11px; padding:3px 8px; }
.an-badge .an-badge__dot{ width:6px; height:6px; border-radius:50%; background:currentColor; }
.an-badge .an-badge__icon{ display:inline-flex; width:13px; height:13px; }
.an-badge .an-badge__icon svg{ width:100%; height:100%; }

.an-badge--neutral{ background:var(--paper-100); color:var(--ink-600); }
.an-badge--brand{ background:var(--violet-50); color:var(--violet-600); }
.an-badge--accent{ background:var(--coral-50); color:var(--coral-600); }
.an-badge--success{ background:var(--success-soft); color:var(--green-600); }
.an-badge--warning{ background:var(--warning-soft); color:var(--amber-600); }
.an-badge--danger{ background:var(--danger-soft); color:var(--red-600); }
.an-badge--solid{ background:var(--violet-500); color:#fff; }
.an-badge--gradient{ background:var(--gradient-sunset); color:#fff; }
`;
if (typeof document !== 'undefined' && !document.getElementById('an-badge-css')) {
  const s = document.createElement('style');
  s.id = 'an-badge-css';
  s.textContent = css;
  document.head.appendChild(s);
}
function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  icon = null,
  className = '',
  ...rest
}) {
  const cls = ['an-badge', `an-badge--${variant}`, size === 'sm' ? 'an-badge--sm' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), dot ? /*#__PURE__*/React.createElement("span", {
    className: "an-badge__dot"
  }) : null, icon ? /*#__PURE__*/React.createElement("span", {
    className: "an-badge__icon"
  }, icon) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.an-btn{
  --_bg: var(--violet-500);
  --_fg: #fff;
  --_bd: transparent;
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  font-family:var(--font-text); font-weight:600; letter-spacing:-0.005em;
  border-radius:var(--radius-pill); border:1.5px solid var(--_bd);
  background:var(--_bg); color:var(--_fg); cursor:pointer;
  white-space:nowrap; text-decoration:none; line-height:1;
  transition:transform var(--dur-fast) var(--ease-out),
             background var(--dur-base) var(--ease-out),
             box-shadow var(--dur-base) var(--ease-out),
             border-color var(--dur-base) var(--ease-out);
  -webkit-tap-highlight-color:transparent;
}
.an-btn:focus-visible{ outline:none; box-shadow:var(--ring); }
.an-btn:active{ transform:translateY(1px) scale(0.985); }
.an-btn[disabled]{ cursor:not-allowed; opacity:0.45; transform:none; box-shadow:none; }

/* sizes */
.an-btn--sm{ height:32px; padding:0 14px; font-size:13px; }
.an-btn--md{ height:40px; padding:0 18px; font-size:14px; }
.an-btn--lg{ height:48px; padding:0 24px; font-size:16px; }
.an-btn--block{ width:100%; }

/* primary */
.an-btn--primary{ --_bg:var(--violet-500); box-shadow:var(--shadow-brand); }
.an-btn--primary:hover:not([disabled]){ --_bg:var(--violet-600); }
/* gradient */
.an-btn--gradient{ background:var(--gradient-sunset); color:#fff; box-shadow:var(--shadow-coral); }
.an-btn--gradient:hover:not([disabled]){ filter:saturate(1.08) brightness(1.03); }
/* secondary (outline) */
.an-btn--secondary{ --_bg:var(--paper-0); --_fg:var(--ink-800); --_bd:var(--ink-200); box-shadow:var(--shadow-xs); }
.an-btn--secondary:hover:not([disabled]){ --_bd:var(--ink-300); background:var(--paper-50); }
/* soft */
.an-btn--soft{ --_bg:var(--violet-50); --_fg:var(--violet-600); }
.an-btn--soft:hover:not([disabled]){ --_bg:var(--violet-100); }
/* ghost */
.an-btn--ghost{ --_bg:transparent; --_fg:var(--ink-700); }
.an-btn--ghost:hover:not([disabled]){ --_bg:var(--paper-100); }
/* danger */
.an-btn--danger{ --_bg:var(--red-500); color:#fff; }
.an-btn--danger:hover:not([disabled]){ --_bg:var(--red-600); }
.an-btn .an-btn__icon{ display:inline-flex; width:1.15em; height:1.15em; }
.an-btn .an-btn__icon svg{ width:100%; height:100%; }
`;
if (typeof document !== 'undefined' && !document.getElementById('an-btn-css')) {
  const s = document.createElement('style');
  s.id = 'an-btn-css';
  s.textContent = css;
  document.head.appendChild(s);
}
function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  leftIcon = null,
  rightIcon = null,
  as = 'button',
  className = '',
  ...rest
}) {
  const Tag = as;
  const cls = ['an-btn', `an-btn--${variant}`, `an-btn--${size}`, block ? 'an-btn--block' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls
  }, rest), leftIcon ? /*#__PURE__*/React.createElement("span", {
    className: "an-btn__icon"
  }, leftIcon) : null, children, rightIcon ? /*#__PURE__*/React.createElement("span", {
    className: "an-btn__icon"
  }, rightIcon) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.an-card{
  background:var(--surface-card); border-radius:var(--radius-lg);
  box-shadow:var(--ring-border), var(--shadow-sm);
  overflow:hidden; position:relative;
  transition:box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out);
}
.an-card--flat{ box-shadow:var(--ring-border); }
.an-card--raised{ box-shadow:var(--shadow-lg); }
.an-card--pad-none{ padding:0; }
.an-card--pad-sm{ padding:16px; }
.an-card--pad-md{ padding:20px; }
.an-card--pad-lg{ padding:28px; }
.an-card--interactive{ cursor:pointer; }
.an-card--interactive:hover{ box-shadow:var(--ring-border), var(--shadow-lg); transform:translateY(-2px); }
.an-card--interactive:active{ transform:translateY(0); }
.an-card--glow::before{
  content:""; position:absolute; inset:0; pointer-events:none;
  background:var(--gradient-bloom); opacity:0.10;
}
`;
if (typeof document !== 'undefined' && !document.getElementById('an-card-css')) {
  const s = document.createElement('style');
  s.id = 'an-card-css';
  s.textContent = css;
  document.head.appendChild(s);
}
function Card({
  children,
  elevation = 'default',
  padding = 'md',
  interactive = false,
  glow = false,
  className = '',
  ...rest
}) {
  const elev = elevation === 'flat' ? 'an-card--flat' : elevation === 'raised' ? 'an-card--raised' : '';
  const cls = ['an-card', elev, `an-card--pad-${padding}`, interactive ? 'an-card--interactive' : '', glow ? 'an-card--glow' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.an-iconbtn{
  display:inline-flex; align-items:center; justify-content:center;
  border:1.5px solid transparent; cursor:pointer; color:var(--ink-600);
  background:transparent; border-radius:var(--radius-md); padding:0;
  transition:background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out),
             border-color var(--dur-base) var(--ease-out), transform var(--dur-fast) var(--ease-out);
  -webkit-tap-highlight-color:transparent;
}
.an-iconbtn:focus-visible{ outline:none; box-shadow:var(--ring); }
.an-iconbtn:active{ transform:scale(0.92); }
.an-iconbtn[disabled]{ opacity:0.4; cursor:not-allowed; }
.an-iconbtn svg{ width:55%; height:55%; }
.an-iconbtn--sm{ width:32px; height:32px; }
.an-iconbtn--md{ width:40px; height:40px; }
.an-iconbtn--lg{ width:48px; height:48px; }

.an-iconbtn--ghost:hover:not([disabled]){ background:var(--paper-100); color:var(--ink-800); }
.an-iconbtn--soft{ background:var(--paper-100); color:var(--ink-700); }
.an-iconbtn--soft:hover:not([disabled]){ background:var(--paper-150); color:var(--ink-900); }
.an-iconbtn--outline{ border-color:var(--ink-200); background:var(--paper-0); box-shadow:var(--shadow-xs); }
.an-iconbtn--outline:hover:not([disabled]){ border-color:var(--ink-300); }
.an-iconbtn--brand{ background:var(--violet-500); color:#fff; box-shadow:var(--shadow-brand); }
.an-iconbtn--brand:hover:not([disabled]){ background:var(--violet-600); }
.an-iconbtn--active{ background:var(--violet-50); color:var(--violet-600); }
`;
if (typeof document !== 'undefined' && !document.getElementById('an-iconbtn-css')) {
  const s = document.createElement('style');
  s.id = 'an-iconbtn-css';
  s.textContent = css;
  document.head.appendChild(s);
}
function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  active = false,
  className = '',
  ...rest
}) {
  const cls = ['an-iconbtn', `an-iconbtn--${variant}`, `an-iconbtn--${size}`, active ? 'an-iconbtn--active' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls,
    "aria-label": label,
    title: label
  }, rest), icon);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.an-field{ display:flex; flex-direction:column; gap:6px; font-family:var(--font-text); }
.an-field__label{ font-size:13px; font-weight:600; color:var(--ink-800); }
.an-field__label .an-field__opt{ color:var(--ink-400); font-weight:500; }
.an-input{
  display:flex; align-items:center; gap:9px;
  background:var(--paper-0); border:1.5px solid var(--ink-200);
  border-radius:var(--radius-md); padding:0 14px; height:44px;
  transition:border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), background var(--dur-base) var(--ease-out);
}
.an-input:hover{ border-color:var(--ink-300); }
.an-input--focused{ border-color:var(--violet-400); box-shadow:var(--ring); }
.an-input--error{ border-color:var(--red-500); }
.an-input--error.an-input--focused{ box-shadow:0 0 0 3px var(--red-100); }
.an-input--sm{ height:36px; border-radius:var(--radius-sm); }
.an-input--disabled{ background:var(--paper-100); opacity:0.7; cursor:not-allowed; }
.an-input__icon{ display:inline-flex; width:18px; height:18px; color:var(--ink-400); flex:none; }
.an-input__icon svg{ width:100%; height:100%; }
.an-input input{
  border:none; outline:none; background:transparent; flex:1; min-width:0;
  font-family:var(--font-text); font-size:15px; color:var(--ink-900); height:100%;
}
.an-input input::placeholder{ color:var(--ink-400); }
.an-field__hint{ font-size:12px; color:var(--ink-500); }
.an-field__hint--error{ color:var(--red-600); }
`;
if (typeof document !== 'undefined' && !document.getElementById('an-input-css')) {
  const s = document.createElement('style');
  s.id = 'an-input-css';
  s.textContent = css;
  document.head.appendChild(s);
}
function Input({
  label,
  hint,
  error,
  optional = false,
  leadingIcon = null,
  trailingIcon = null,
  size = 'md',
  disabled = false,
  className = '',
  id,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const reactId = React.useId ? React.useId() : undefined;
  const fieldId = id || reactId;
  const boxCls = ['an-input', size === 'sm' ? 'an-input--sm' : '', focused ? 'an-input--focused' : '', error ? 'an-input--error' : '', disabled ? 'an-input--disabled' : ''].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", {
    className: ['an-field', className].filter(Boolean).join(' ')
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "an-field__label",
    htmlFor: fieldId
  }, label, optional ? /*#__PURE__*/React.createElement("span", {
    className: "an-field__opt"
  }, " \xB7 optional") : null) : null, /*#__PURE__*/React.createElement("div", {
    className: boxCls
  }, leadingIcon ? /*#__PURE__*/React.createElement("span", {
    className: "an-input__icon"
  }, leadingIcon) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    disabled: disabled,
    onFocus: e => {
      setFocused(true);
      rest.onFocus && rest.onFocus(e);
    },
    onBlur: e => {
      setFocused(false);
      rest.onBlur && rest.onBlur(e);
    }
  }, rest)), trailingIcon ? /*#__PURE__*/React.createElement("span", {
    className: "an-input__icon"
  }, trailingIcon) : null), hint || error ? /*#__PURE__*/React.createElement("span", {
    className: ['an-field__hint', error ? 'an-field__hint--error' : ''].filter(Boolean).join(' ')
  }, error || hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/SegmentedControl.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.an-seg{
  display:inline-flex; align-items:center; gap:2px; padding:4px;
  background:var(--paper-100); border-radius:var(--radius-pill);
  font-family:var(--font-text);
}
.an-seg__btn{
  appearance:none; border:none; cursor:pointer; background:transparent;
  font-family:inherit; font-size:14px; font-weight:600; color:var(--ink-500);
  padding:7px 16px; border-radius:var(--radius-pill); line-height:1;
  display:inline-flex; align-items:center; gap:7px; white-space:nowrap;
  transition:color var(--dur-base) var(--ease-out), background var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out);
}
.an-seg__btn svg{ width:15px; height:15px; }
.an-seg__btn:hover{ color:var(--ink-800); }
.an-seg__btn--active{ background:var(--paper-0); color:var(--violet-600); box-shadow:var(--shadow-sm); }
.an-seg__btn--active:hover{ color:var(--violet-600); }
.an-seg--sm .an-seg__btn{ font-size:13px; padding:5px 12px; }
`;
if (typeof document !== 'undefined' && !document.getElementById('an-seg-css')) {
  const s = document.createElement('style');
  s.id = 'an-seg-css';
  s.textContent = css;
  document.head.appendChild(s);
}
function SegmentedControl({
  options = [],
  value,
  onChange,
  size = 'md',
  className = '',
  ...rest
}) {
  const cls = ['an-seg', size === 'sm' ? 'an-seg--sm' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    role: "tablist"
  }, rest), options.map(opt => {
    const val = typeof opt === 'string' ? opt : opt.value;
    const label = typeof opt === 'string' ? opt : opt.label;
    const icon = typeof opt === 'string' ? null : opt.icon;
    const active = val === value;
    return /*#__PURE__*/React.createElement("button", {
      key: val,
      type: "button",
      role: "tab",
      "aria-selected": active,
      className: ['an-seg__btn', active ? 'an-seg__btn--active' : ''].filter(Boolean).join(' '),
      onClick: () => onChange && onChange(val)
    }, icon, label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/core/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.an-switch{
  display:inline-flex; align-items:center; gap:10px; cursor:pointer;
  font-family:var(--font-text); font-size:14px; color:var(--ink-700); user-select:none;
}
.an-switch__track{
  position:relative; flex:none; width:42px; height:24px; border-radius:var(--radius-pill);
  background:var(--ink-200); transition:background var(--dur-base) var(--ease-out);
}
.an-switch__track--sm{ width:34px; height:20px; }
.an-switch__thumb{
  position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%;
  background:#fff; box-shadow:var(--shadow-sm);
  transition:transform var(--dur-base) var(--ease-spring);
}
.an-switch__track--sm .an-switch__thumb{ width:14px; height:14px; }
.an-switch input{ position:absolute; opacity:0; width:0; height:0; }
.an-switch input:checked + .an-switch__track{ background:var(--violet-500); }
.an-switch input:checked + .an-switch__track .an-switch__thumb{ transform:translateX(18px); }
.an-switch input:checked + .an-switch__track--sm .an-switch__thumb{ transform:translateX(14px); }
.an-switch input:focus-visible + .an-switch__track{ box-shadow:var(--ring); }
.an-switch--disabled{ opacity:0.5; cursor:not-allowed; }
`;
if (typeof document !== 'undefined' && !document.getElementById('an-switch-css')) {
  const s = document.createElement('style');
  s.id = 'an-switch-css';
  s.textContent = css;
  document.head.appendChild(s);
}
function Switch({
  checked,
  defaultChecked,
  onChange,
  label,
  size = 'md',
  disabled = false,
  className = '',
  ...rest
}) {
  const cls = ['an-switch', disabled ? 'an-switch--disabled' : '', className].filter(Boolean).join(' ');
  const trackCls = ['an-switch__track', size === 'sm' ? 'an-switch__track--sm' : ''].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("label", {
    className: cls
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: checked,
    defaultChecked: defaultChecked,
    onChange: onChange,
    disabled: disabled
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: trackCls
  }, /*#__PURE__*/React.createElement("span", {
    className: "an-switch__thumb"
  })), label ? /*#__PURE__*/React.createElement("span", null, label) : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Switch.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.an-tag{
  display:inline-flex; align-items:center; gap:6px;
  font-family:var(--font-text); font-size:13px; font-weight:500; line-height:1;
  padding:7px 12px; border-radius:var(--radius-pill);
  background:var(--paper-0); color:var(--ink-700);
  border:1.5px solid var(--ink-200); cursor:default;
  transition:background var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out),
             color var(--dur-base) var(--ease-out), transform var(--dur-fast) var(--ease-out);
  -webkit-tap-highlight-color:transparent;
}
.an-tag__icon{ display:inline-flex; width:14px; height:14px; }
.an-tag__icon svg{ width:100%; height:100%; }
.an-tag--clickable{ cursor:pointer; }
.an-tag--clickable:hover{ border-color:var(--ink-300); background:var(--paper-50); }
.an-tag--clickable:active{ transform:scale(0.97); }
.an-tag--selected{ background:var(--violet-50); border-color:var(--violet-300); color:var(--violet-700); }
.an-tag--selected:hover{ background:var(--violet-100); border-color:var(--violet-300); }
.an-tag--anchor{ background:var(--coral-50); border-color:var(--coral-200); color:var(--coral-600); }
.an-tag__remove{
  display:inline-flex; align-items:center; justify-content:center;
  width:16px; height:16px; margin-right:-2px; border-radius:50%;
  border:none; background:transparent; color:inherit; cursor:pointer; opacity:0.6; padding:0;
}
.an-tag__remove:hover{ opacity:1; background:rgba(22,23,42,0.08); }
.an-tag__remove svg{ width:10px; height:10px; }
`;
if (typeof document !== 'undefined' && !document.getElementById('an-tag-css')) {
  const s = document.createElement('style');
  s.id = 'an-tag-css';
  s.textContent = css;
  document.head.appendChild(s);
}
const xIcon = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 12 12",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.8",
  strokeLinecap: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M2.5 2.5l7 7M9.5 2.5l-7 7"
}));
function Tag({
  children,
  icon = null,
  selected = false,
  anchor = false,
  onRemove = null,
  onClick = null,
  className = '',
  ...rest
}) {
  const clickable = !!onClick;
  const cls = ['an-tag', clickable ? 'an-tag--clickable' : '', selected ? 'an-tag--selected' : '', anchor ? 'an-tag--anchor' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    onClick: onClick
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    className: "an-tag__icon"
  }, icon) : null, children, onRemove ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "an-tag__remove",
    "aria-label": "Remove",
    onClick: e => {
      e.stopPropagation();
      onRemove(e);
    }
  }, xIcon) : null);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/map/AnchorPin.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.an-pin{ position:relative; display:inline-flex; flex-direction:column; align-items:center; --_c:var(--coral-500); }
.an-pin__head{
  position:relative; display:flex; align-items:center; justify-content:center;
  background:var(--_c); color:#fff; border-radius:50%;
  box-shadow:0 0 0 3px #fff, var(--shadow-md);
  font-family:var(--font-text); font-weight:700; line-height:1; z-index:1;
}
.an-pin__head svg{ width:55%; height:55%; }
.an-pin__head::after{
  content:""; position:absolute; bottom:-5px; left:50%; transform:translateX(-50%) rotate(45deg);
  width:10px; height:10px; background:var(--_c); border-radius:0 0 3px 0; z-index:-1;
}
.an-pin--md .an-pin__head{ width:34px; height:34px; font-size:14px; }
.an-pin--sm .an-pin__head{ width:26px; height:26px; font-size:12px; }
.an-pin--lg .an-pin__head{ width:44px; height:44px; font-size:17px; }

.an-pin--anchor{ --_c:var(--coral-500); }
.an-pin--suggestion{ --_c:var(--violet-500); }
.an-pin--visited{ --_c:var(--green-500); }
.an-pin--muted .an-pin__head{ background:#fff; color:var(--ink-500); box-shadow:0 0 0 1.5px var(--ink-200), var(--shadow-sm); }
.an-pin--muted .an-pin__head::after{ background:#fff; box-shadow:1.5px 1.5px 0 0 var(--ink-200); }

.an-pin--gradient .an-pin__head{ background:var(--gradient-sunset); }
.an-pin--gradient .an-pin__head::after{ background:#F857A6; }

.an-pin--selected .an-pin__head{ box-shadow:0 0 0 3px #fff, 0 0 0 7px color-mix(in srgb, var(--_c) 28%, transparent), var(--shadow-lg); }
.an-pin__label{
  margin-top:7px; background:#fff; color:var(--ink-800);
  font-family:var(--font-text); font-size:12px; font-weight:600; line-height:1;
  padding:5px 9px; border-radius:var(--radius-pill); white-space:nowrap;
  box-shadow:var(--shadow-sm); max-width:140px; overflow:hidden; text-overflow:ellipsis;
}
.an-pin--pulse .an-pin__head{ animation:an-pin-pulse 2s var(--ease-out) infinite; }
@keyframes an-pin-pulse{
  0%,100%{ box-shadow:0 0 0 3px #fff, 0 0 0 0 color-mix(in srgb, var(--_c) 40%, transparent); }
  70%{ box-shadow:0 0 0 3px #fff, 0 0 0 12px color-mix(in srgb, var(--_c) 0%, transparent); }
}
`;
if (typeof document !== 'undefined' && !document.getElementById('an-pin-css')) {
  const s = document.createElement('style');
  s.id = 'an-pin-css';
  s.textContent = css;
  document.head.appendChild(s);
}
function AnchorPin({
  number = null,
  icon = null,
  label = null,
  variant = 'anchor',
  size = 'md',
  selected = false,
  gradient = false,
  pulse = false,
  className = '',
  ...rest
}) {
  const cls = ['an-pin', `an-pin--${variant}`, `an-pin--${size}`, selected ? 'an-pin--selected' : '', gradient ? 'an-pin--gradient' : '', pulse ? 'an-pin--pulse' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "an-pin__head"
  }, icon || number), label ? /*#__PURE__*/React.createElement("span", {
    className: "an-pin__label"
  }, label) : null);
}
Object.assign(__ds_scope, { AnchorPin });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/AnchorPin.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Map.jsx
try { (() => {
/* Anchor UI kit — MapCanvas: a light illustrative map with AnchorPins. -> window.AnchorMap */
(function () {
  const {
    AnchorIcons: Ic,
    ANCHOR_DATA: DATA
  } = window;
  const {
    AnchorPin
  } = window.AnchorDesignSystem_997765;

  // soft decorative map base — water, parks, road grid — all CSS/SVG, no tiles
  function MapBase() {
    return React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        overflow: 'hidden'
      }
    },
    // land wash
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(160deg,#F3F4FB 0%,#EFF0F8 100%)'
      }
    }), React.createElement('svg', {
      viewBox: '0 0 100 100',
      preserveAspectRatio: 'none',
      style: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%'
      }
    },
    // river / water
    React.createElement('path', {
      d: 'M-2 64 C 18 58, 30 70, 50 64 S 84 50, 102 58 L 102 102 -2 102 Z',
      fill: '#DCE7F7'
    }), React.createElement('path', {
      d: 'M-2 64 C 18 58, 30 70, 50 64 S 84 50, 102 58',
      fill: 'none',
      stroke: '#CBDAF0',
      strokeWidth: 0.6
    }),
    // park blobs
    React.createElement('ellipse', {
      cx: 26,
      cy: 50,
      rx: 9,
      ry: 7,
      fill: '#D9EFE0'
    }), React.createElement('ellipse', {
      cx: 80,
      cy: 30,
      rx: 6,
      ry: 5,
      fill: '#D9EFE0'
    }),
    // road grid (thin, organic)
    React.createElement('g', {
      stroke: '#E4E6F1',
      strokeWidth: 0.7,
      fill: 'none',
      strokeLinecap: 'round'
    }, React.createElement('path', {
      d: 'M0 20 H100'
    }), React.createElement('path', {
      d: 'M0 38 H100'
    }), React.createElement('path', {
      d: 'M0 80 H100'
    }), React.createElement('path', {
      d: 'M18 0 V100'
    }), React.createElement('path', {
      d: 'M44 0 V100'
    }), React.createElement('path', {
      d: 'M68 0 V100'
    }), React.createElement('path', {
      d: 'M88 0 V100'
    })), React.createElement('g', {
      stroke: '#EDEEF6',
      strokeWidth: 1.6,
      fill: 'none',
      strokeLinecap: 'round'
    }, React.createElement('path', {
      d: 'M0 29 H100'
    }), React.createElement('path', {
      d: 'M30 0 L 60 100'
    }), React.createElement('path', {
      d: 'M56 0 V64'
    }))));
  }
  function MapCanvas({
    order = [],
    extra = [],
    selectedId,
    onSelect,
    showSuggestions = true,
    radius = 24,
    dashTo = null
  }) {
    const anchorPos = order.map(id => DATA.places[id]).filter(Boolean);
    return React.createElement('div', {
      style: {
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: radius,
        overflow: 'hidden',
        boxShadow: 'var(--ring-border)'
      }
    }, React.createElement(MapBase),
    // route line connecting anchors
    anchorPos.length > 1 && React.createElement('svg', {
      viewBox: '0 0 100 100',
      preserveAspectRatio: 'none',
      style: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
      }
    }, React.createElement('path', {
      d: 'M ' + anchorPos.map(p => p.x + ' ' + p.y).join(' L '),
      fill: 'none',
      stroke: 'var(--violet-400)',
      strokeWidth: 0.7,
      strokeDasharray: '1.4 1.8',
      strokeLinecap: 'round',
      opacity: 0.7
    })),
    // suggestion pins (under anchors)
    showSuggestions && extra.map(id => {
      const p = DATA.places[id];
      if (!p) return null;
      const c = DATA.CAT[p.cat];
      return React.createElement('div', {
        key: id,
        style: pinWrap(p, selectedId === id ? 6 : 3)
      }, React.createElement('div', {
        onClick: () => onSelect && onSelect(id),
        style: {
          cursor: 'pointer'
        }
      }, React.createElement(AnchorPin, {
        variant: p.stay ? 'visited' : 'suggestion',
        size: 'sm',
        icon: React.createElement(Ic[c.icon] || Ic.Pin),
        selected: selectedId === id
      })));
    }),
    // anchor pins (numbered, on top)
    anchorPos.map((p, i) => {
      const id = order[i];
      return React.createElement('div', {
        key: id,
        style: pinWrap(p, selectedId === id ? 7 : 5)
      }, React.createElement('div', {
        onClick: () => onSelect && onSelect(id),
        style: {
          cursor: 'pointer'
        }
      }, React.createElement(AnchorPin, {
        variant: 'anchor',
        number: i + 1,
        size: selectedId === id ? 'lg' : 'md',
        selected: selectedId === id,
        label: selectedId === id ? p.name : null,
        pulse: selectedId === id
      })));
    }));
  }
  function pinWrap(p, z) {
    return {
      position: 'absolute',
      left: p.x + '%',
      top: p.y + '%',
      transform: 'translate(-50%,-100%)',
      zIndex: z
    };
  }
  window.AnchorMap = {
    MapCanvas
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Map.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Shell.jsx
try { (() => {
/* Anchor UI kit — Shell: Sidebar, Topbar, PlaceImage. -> window.AnchorShell */
(function () {
  const {
    AnchorIcons: Ic,
    ANCHOR_DATA: DATA
  } = window;
  const {
    Avatar,
    IconButton,
    Badge
  } = window.AnchorDesignSystem_997765;
  const MARK = '../../assets/anchor-mark.svg';

  // Stylised place imagery: branded gradient tile + category watermark.
  function PlaceImage({
    cat,
    h = 120,
    radius = 16,
    name,
    children,
    style
  }) {
    const c = DATA.CAT[cat] || DATA.CAT.nbhd;
    const Watermark = Ic[c.icon] || Ic.Pin;
    return React.createElement('div', {
      style: Object.assign({
        position: 'relative',
        height: h,
        borderRadius: radius,
        overflow: 'hidden',
        background: c.grad,
        flex: 'none'
      }, style)
    }, React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(120% 90% at 80% 10%, rgba(255,255,255,.35), transparent 60%)'
      }
    }), React.createElement(Watermark, {
      style: {
        position: 'absolute',
        right: -10,
        bottom: -14,
        fontSize: h * 0.7,
        color: 'rgba(255,255,255,.28)',
        strokeWidth: 1.5
      }
    }), children);
  }
  function NavItem({
    icon: IconC,
    label,
    active,
    onClick
  }) {
    return React.createElement('button', {
      onClick,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 12px',
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-text)',
        fontSize: 14.5,
        fontWeight: 600,
        textAlign: 'left',
        background: active ? 'var(--violet-50)' : 'transparent',
        color: active ? 'var(--violet-600)' : 'var(--ink-600)',
        transition: 'background .2s, color .2s'
      },
      onMouseEnter: e => {
        if (!active) e.currentTarget.style.background = 'var(--paper-100)';
      },
      onMouseLeave: e => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }
    }, React.createElement(IconC, {
      style: {
        fontSize: 19
      }
    }), label);
  }
  function Sidebar({
    route,
    setRoute,
    trips,
    activeTrip
  }) {
    return React.createElement('aside', {
      style: {
        width: 248,
        flex: 'none',
        background: 'var(--paper-0)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 14px',
        gap: 18,
        height: '100%',
        boxSizing: 'border-box'
      }
    },
    // brand
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '4px 6px'
      }
    }, React.createElement('img', {
      src: MARK,
      width: 30,
      height: 30,
      alt: ''
    }), React.createElement('span', {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 22,
        letterSpacing: '-0.02em',
        color: 'var(--ink-900)'
      }
    }, 'Anchor')),
    // primary nav
    React.createElement('nav', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }
    }, React.createElement(NavItem, {
      icon: Ic.Home,
      label: 'Trips',
      active: route === 'board',
      onClick: () => setRoute('board')
    }), React.createElement(NavItem, {
      icon: Ic.Map,
      label: 'Planner',
      active: route === 'planner',
      onClick: () => setRoute('planner')
    }), React.createElement(NavItem, {
      icon: Ic.Compass,
      label: 'Discover',
      active: route === 'discover',
      onClick: () => setRoute('discover')
    }), React.createElement(NavItem, {
      icon: Ic.Bookmark,
      label: 'Saved',
      active: false,
      onClick: () => {}
    })),
    // trips
    React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        marginTop: 2
      }
    }, React.createElement('div', {
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: 'var(--ink-400)',
        padding: '0 8px'
      }
    }, 'Your trips'), trips.map(t => React.createElement('button', {
      key: t.id,
      onClick: () => {
        setRoute('planner');
      },
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 8px',
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        background: activeTrip === t.id ? 'var(--paper-100)' : 'transparent',
        fontFamily: 'var(--font-text)',
        textAlign: 'left',
        width: '100%'
      }
    }, React.createElement('span', {
      style: {
        width: 26,
        height: 26,
        borderRadius: 8,
        background: t.grad,
        flex: 'none'
      }
    }), React.createElement('span', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        lineHeight: 1.25,
        overflow: 'hidden'
      }
    }, React.createElement('span', {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: 'var(--ink-800)'
      }
    }, t.name), React.createElement('span', {
      style: {
        fontSize: 11.5,
        color: 'var(--ink-400)'
      }
    }, t.dates))))),
    // spacer + user
    React.createElement('div', {
      style: {
        marginTop: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 6px',
        borderTop: '1px solid var(--border-subtle)'
      }
    }, React.createElement(Avatar, {
      name: 'Mira Tan',
      size: 'sm',
      status: true
    }), React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        lineHeight: 1.2,
        flex: 1
      }
    }, React.createElement('span', {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--ink-800)'
      }
    }, 'Mira Tan'), React.createElement('span', {
      style: {
        fontSize: 11.5,
        color: 'var(--ink-400)'
      }
    }, 'Free plan')), React.createElement(IconButton, {
      icon: React.createElement(Ic.Settings),
      label: 'Settings',
      variant: 'ghost',
      size: 'sm'
    })));
  }
  window.AnchorShell = {
    Sidebar,
    PlaceImage,
    MARK
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/data.js
try { (() => {
/* Anchor UI kit — sample content. Exposed as window.ANCHOR_DATA. */
window.ANCHOR_DATA = function () {
  // category -> { icon name, gradient, soft, ink }
  const CAT = {
    art: {
      icon: 'Sparkles',
      grad: 'linear-gradient(135deg,#A98BFF,#F857A6)',
      label: 'Art'
    },
    food: {
      icon: 'Utensils',
      grad: 'linear-gradient(135deg,#FF9E5E,#F857A6)',
      label: 'Food'
    },
    culture: {
      icon: 'Building',
      grad: 'linear-gradient(135deg,#FFB36B,#FB7242)',
      label: 'Culture'
    },
    views: {
      icon: 'Camera',
      grad: 'linear-gradient(135deg,#8B72FB,#FF8FC0)',
      label: 'Views'
    },
    nature: {
      icon: 'Tree',
      grad: 'linear-gradient(135deg,#5BD6B0,#8B72FB)',
      label: 'Nature'
    },
    nbhd: {
      icon: 'Compass',
      grad: 'linear-gradient(135deg,#FF8FC0,#A98BFF)',
      label: 'Neighborhood'
    },
    coffee: {
      icon: 'Coffee',
      grad: 'linear-gradient(135deg,#FFC59E,#FB7242)',
      label: 'Coffee'
    },
    stay: {
      icon: 'Bed',
      grad: 'linear-gradient(135deg,#9AA0FF,#6C5CE7)',
      label: 'Stay'
    }
  };

  // anchors (must-go) + suggestions, positioned on the stylised map (x%,y%)
  const places = {
    teamlab: {
      name: 'teamLab Planets',
      cat: 'art',
      area: 'Toyosu',
      rating: 4.8,
      mins: 90,
      x: 72,
      y: 70,
      anchor: true,
      note: 'Booked 10:00 entry — go early before crowds.'
    },
    senso: {
      name: 'Sensō-ji Temple',
      cat: 'culture',
      area: 'Asakusa',
      rating: 4.7,
      mins: 60,
      x: 78,
      y: 24,
      anchor: true,
      note: 'Nakamise street for snacks on the way in.'
    },
    ichiran: {
      name: 'Ichiran Shibuya',
      cat: 'food',
      area: 'Shibuya',
      rating: 4.6,
      mins: 45,
      x: 30,
      y: 62,
      anchor: true,
      note: 'Solo ramen booths. Expect a short queue.'
    },
    sky: {
      name: 'Shibuya Sky',
      cat: 'views',
      area: 'Shibuya',
      rating: 4.9,
      mins: 60,
      x: 33,
      y: 58,
      anchor: true,
      note: 'Sunset slot — arrive 30 min before.'
    },
    tsukiji: {
      name: 'Tsukiji Market',
      cat: 'food',
      area: 'Tsukiji',
      rating: 4.5,
      mins: 75,
      x: 58,
      y: 56,
      anchor: true,
      note: 'Tamagoyaki + uni. Cash helps.'
    },
    shimo: {
      name: 'Shimokitazawa',
      cat: 'nbhd',
      area: 'Setagaya',
      rating: 4.6,
      mins: 120,
      x: 16,
      y: 50,
      anchor: true,
      note: 'Vintage shops + tiny coffee bars.'
    },
    // suggestions that fit between anchors
    blue: {
      name: 'Blue Bottle Kiyosumi',
      cat: 'coffee',
      area: 'Kiyosumi',
      rating: 4.4,
      mins: 30,
      x: 66,
      y: 46
    },
    nezu: {
      name: 'Nezu Museum',
      cat: 'art',
      area: 'Aoyama',
      rating: 4.5,
      mins: 60,
      x: 40,
      y: 52
    },
    yoyogi: {
      name: 'Yoyogi Park',
      cat: 'nature',
      area: 'Harajuku',
      rating: 4.6,
      mins: 45,
      x: 27,
      y: 50
    },
    omoide: {
      name: 'Omoide Yokocho',
      cat: 'food',
      area: 'Shinjuku',
      rating: 4.4,
      mins: 60,
      x: 22,
      y: 42
    },
    hotel: {
      name: 'The Aoyama Grand',
      cat: 'stay',
      area: 'Aoyama',
      rating: 4.7,
      mins: 0,
      x: 38,
      y: 56,
      stay: true
    }
  };
  const days = [{
    id: 'd1',
    date: 'Tue, Apr 12',
    title: 'Arrival & Shibuya',
    items: [{
      place: 'hotel',
      time: '14:00',
      kind: 'stay'
    }, {
      place: 'ichiran',
      time: '18:30'
    }, {
      place: 'sky',
      time: '19:30'
    }]
  }, {
    id: 'd2',
    date: 'Wed, Apr 13',
    title: 'Old Tokyo',
    items: [{
      place: 'senso',
      time: '09:30'
    }, {
      place: 'blue',
      time: '11:30',
      suggested: true
    }, {
      place: 'tsukiji',
      time: '13:00'
    }]
  }, {
    id: 'd3',
    date: 'Thu, Apr 14',
    title: 'Art & Toyosu',
    items: [{
      place: 'nezu',
      time: '10:00',
      suggested: true
    }, {
      place: 'teamlab',
      time: '14:00'
    }]
  }, {
    id: 'd4',
    date: 'Fri, Apr 15',
    title: 'West side',
    items: [{
      place: 'shimo',
      time: '11:00'
    }, {
      place: 'yoyogi',
      time: '15:00',
      suggested: true
    }]
  }];
  const trips = [{
    id: 'tokyo',
    name: 'Tokyo',
    sub: 'Spring food & art',
    dates: 'Apr 12–15',
    days: 4,
    anchors: 6,
    saved: 12,
    grad: 'linear-gradient(135deg,#FF9E5E,#F857A6 55%,#8B5CF6)',
    cover: 'views'
  }, {
    id: 'lisbon',
    name: 'Lisbon',
    sub: 'Tiles & miradouros',
    dates: 'May 2–7',
    days: 5,
    anchors: 4,
    saved: 9,
    grad: 'linear-gradient(135deg,#FFC59E,#FF8FC0,#A98BFF)',
    cover: 'culture'
  }, {
    id: 'oaxaca',
    name: 'Oaxaca',
    sub: 'Mezcal & markets',
    dates: 'Jul 9–14',
    days: 5,
    anchors: 5,
    saved: 14,
    grad: 'linear-gradient(135deg,#5BD6B0,#8B72FB)',
    cover: 'food'
  }];
  return {
    CAT,
    places,
    days,
    trips
  };
}();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/data.js", error: String((e && e.message) || e) }); }

// ui_kits/app/icons.js
try { (() => {
/* Anchor UI kit — shared icon set (Lucide-style, 24px line icons).
   Exposed as window.AnchorIcons. */
(function () {
  const I = (paths, opts = {}) => function Icon(props) {
    return React.createElement('svg', Object.assign({
      viewBox: '0 0 24 24',
      fill: opts.fill || 'none',
      stroke: 'currentColor',
      strokeWidth: opts.sw || 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      width: '1em',
      height: '1em'
    }, props), paths.map((d, i) => d.c ? React.createElement('circle', {
      key: i,
      cx: d.c[0],
      cy: d.c[1],
      r: d.c[2]
    }) : React.createElement('path', {
      key: i,
      d
    })));
  };
  window.AnchorIcons = {
    Anchor: I(['M12 7v13', 'M8 16a4 4 0 0 0 8 0', 'M5 13l-2 1a9 9 0 0 0 18 0l-2-1', {
      c: [12, 5, 2]
    }]),
    Pin: I(['M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z', {
      c: [12, 11, 2]
    }]),
    Search: I(['M21 21l-4.2-4.2', {
      c: [11, 11, 7]
    }]),
    Plus: I(['M12 5v14', 'M5 12h14']),
    Compass: I([{
      c: [12, 12, 9]
    }, 'M15.5 8.5l-2 5-5 2 2-5 5-2z']),
    Map: I(['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z', 'M9 4v14', 'M15 6v14']),
    List: I(['M8 6h13', 'M8 12h13', 'M8 18h13', {
      c: [3.5, 6, 1]
    }, {
      c: [3.5, 12, 1]
    }, {
      c: [3.5, 18, 1]
    }]),
    Calendar: I(['M3 9h18', 'M8 3v4', 'M16 3v4', 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z']),
    Heart: I(['M12 20s-7-4.6-9.2-9C1.3 8 2.6 4.8 6 4.8c2 0 3.2 1.4 4 2.6.8-1.2 2-2.6 4-2.6 3.4 0 4.7 3.2 3.2 6.2C19 15.4 12 20 12 20z']),
    HeartFill: I(['M12 20s-7-4.6-9.2-9C1.3 8 2.6 4.8 6 4.8c2 0 3.2 1.4 4 2.6.8-1.2 2-2.6 4-2.6 3.4 0 4.7 3.2 3.2 6.2C19 15.4 12 20 12 20z'], {
      fill: 'currentColor'
    }),
    Share: I([{
      c: [18, 5, 3]
    }, {
      c: [6, 12, 3]
    }, {
      c: [18, 19, 3]
    }, 'M8.6 13.5l6.8 4', 'M15.4 6.5l-6.8 4']),
    Star: I(['M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z'], {
      fill: 'currentColor',
      sw: 0
    }),
    Clock: I([{
      c: [12, 12, 9]
    }, 'M12 7.5V12l3 1.8']),
    Coffee: I(['M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z', 'M17 9h2.5a2.5 2.5 0 0 1 0 5H17', 'M8 2.5v2', 'M12 2.5v2']),
    Utensils: I(['M5 3v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3', 'M7 12v9', 'M17 3c-1.5 0-3 1.8-3 5s1.5 4 3 4v9']),
    Camera: I(['M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', {
      c: [12, 13, 3.5]
    }]),
    Building: I(['M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16', 'M15 9h2a2 2 0 0 1 2 2v10', 'M3 21h18', 'M9 7h2', 'M9 11h2', 'M9 15h2']),
    Tree: I(['M12 22v-6', 'M12 16c4 0 6-2.6 6-5.5 0-1.6-.8-3-2-3.8C16 4.4 14.2 3 12 3S8 4.4 8 6.7C6.8 7.5 6 8.9 6 10.5 6 13.4 8 16 12 16z']),
    Bed: I(['M3 7v12', 'M3 13h18v6', 'M21 19v-5a3 3 0 0 0-3-3H9v5', {
      c: [6.5, 9.5, 1.5]
    }]),
    Walk: I([{
      c: [13, 4.5, 1.5]
    }, 'M11 21l1.5-5-2.5-2 1-5 3 2 2 1', 'M9 12l1-2', 'M14 11l1 4 2 4']),
    Plane: I(['M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-4.5L21 16z'], {
      fill: 'currentColor',
      sw: 0
    }),
    Sparkles: I(['M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z', 'M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z'], {
      fill: 'currentColor',
      sw: 0
    }),
    Check: I(['M5 13l4 4 10-11']),
    ChevronRight: I(['M9 6l6 6-6 6']),
    ChevronLeft: I(['M15 6l-6 6 6 6']),
    ChevronDown: I(['M6 9l6 6 6-6']),
    More: I([{
      c: [5, 12, 1.4]
    }, {
      c: [12, 12, 1.4]
    }, {
      c: [19, 12, 1.4]
    }], {
      fill: 'currentColor',
      sw: 0
    }),
    X: I(['M6 6l12 12', 'M18 6L6 18']),
    Grip: I([{
      c: [9, 6, 1]
    }, {
      c: [15, 6, 1]
    }, {
      c: [9, 12, 1]
    }, {
      c: [15, 12, 1]
    }, {
      c: [9, 18, 1]
    }, {
      c: [15, 18, 1]
    }], {
      fill: 'currentColor',
      sw: 0
    }),
    Settings: I([{
      c: [12, 12, 3]
    }, 'M19.4 15a1.5 1.5 0 0 0 .3 1.6l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.5 1.5 0 0 0-2.5 1V21a2 2 0 0 1-4 0v-.1a1.5 1.5 0 0 0-2.5-1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.5 1.5 0 0 0-1-2.5H4a2 2 0 0 1 0-4h.1a1.5 1.5 0 0 0 1-2.5l-.1-.1A2 2 0 1 1 7.8 4.5l.1.1a1.5 1.5 0 0 0 2.5-1V4a2 2 0 0 1 4 0v.1a1.5 1.5 0 0 0 2.5 1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.5 1.5 0 0 0-.3 1.6']),
    Home: I(['M3 11l9-7 9 7', 'M5 10v10h14V10']),
    Bookmark: I(['M6 4h12v17l-6-4-6 4V4z']),
    Globe: I([{
      c: [12, 12, 9]
    }, 'M3 12h18', 'M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3z']),
    Filter: I(['M3 5h18l-7 8v5l-4 2v-7L3 5z']),
    Wallet: I(['M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h12', {
      c: [16.5, 13, 1.2]
    }]),
    Sun: I([{
      c: [12, 12, 4]
    }, 'M12 2v2', 'M12 20v2', 'M4 12H2', 'M22 12h-2', 'M5 5l1.5 1.5', 'M17.5 17.5L19 19', 'M19 5l-1.5 1.5', 'M6.5 17.5L5 19']),
    Train: I(['M6 3h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M4 11h16', 'M8 20l-2 2', 'M16 20l2 2', {
      c: [8.5, 13.5, 0.8]
    }, {
      c: [15.5, 13.5, 0.8]
    }])
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/icons.js", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.AnchorPin = __ds_scope.AnchorPin;

})();
