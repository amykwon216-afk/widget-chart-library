/**
 * Local mock replacements for @thryvlabs/dex-react.
 * Provides visual parity without any private registry dependency.
 */
import React, { useState, useEffect, useRef, useContext, createContext } from 'react';

// ─── Notification context ──────────────────────────────────────────────────
var NotificationCtx = createContext({ open: function() {} });

export function DexNotificationProvider({ children }) {
  var [toasts, setToasts] = useState([]);

  var open = function(opts) {
    var id = Math.random().toString(36).slice(2);
    var duration = opts.duration || 3000;
    setToasts(function(prev) { return prev.concat([{ id: id, ...opts }]); });
    setTimeout(function() {
      setToasts(function(prev) { return prev.filter(function(t) { return t.id !== id; }); });
    }, duration);
  };

  return (
    <NotificationCtx.Provider value={{ open: open }}>
      {children}
      <div className="dex-notification-viewport">
        {toasts.map(function(t) {
          var cls = 'dex-toast dex-toast-' + (t.variant || 'info');
          return (
            <div key={t.id} className={cls}>
              <div className="dex-toast-icon">
                {t.variant === 'success' && <DexIcon name="check" size="sm" />}
                {t.variant === 'danger' && <span style={{ fontWeight: 700 }}>!</span>}
              </div>
              <div>
                {t.title && <div className="dex-toast-title">{t.title}</div>}
                {t.description && <div className="dex-toast-desc">{t.description}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </NotificationCtx.Provider>
  );
}

export function DexNotificationViewport() {
  // Viewport is now inlined inside DexNotificationProvider
  return null;
}

export function useNotification() {
  return useContext(NotificationCtx);
}

// ─── Pass-through providers ────────────────────────────────────────────────
export function DexProvider({ children }) {
  return <>{children}</>;
}

export function DexTooltipProvider({ children }) {
  return <>{children}</>;
}

// ─── Icons ─────────────────────────────────────────────────────────────────
var ICON_SIZE = { xs: 12, sm: 16, md: 20, lg: 24 };

var PATHS = {
  'search': 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-2a6 6 0 1 1 0-12 6 6 0 0 1 0 12zm4.95-.636 1.414 1.414-2.12 2.122-1.415-1.415 2.12-2.12z',
  'x-circle-fill': 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm3.707 12.293-1.414 1.414L12 13.414l-2.293 2.293-1.414-1.414L10.586 12 8.293 9.707l1.414-1.414L12 10.586l2.293-2.293 1.414 1.414L13.414 12l2.293 2.293z',
  'more-vertical': 'M12 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM12 19.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  'code': 'M8.828 3.172 3 9l5.828 5.828 1.415-1.415L5.828 9l4.415-4.414-1.415-1.414zM15.172 3.172 21 9l-5.828 5.828-1.415-1.415L18.172 9l-4.415-4.414 1.415-1.414z',
  'check': 'M20 6 9 17l-5-5 1.414-1.414L9 14.172 18.586 4.586 20 6z',
  'clipboard': 'M16 2H8a2 2 0 0 0-2 2v1H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2V4a2 2 0 0 0-2-2zm-6 2h4v2h-4V4zM4 21V7h2v14H4zm16 0H8V7h12v14z',
  'chevron-down': 'M7 10l5 5 5-5H7z',
  'external-link': 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.586l-9.293 9.293 1.414 1.414L19 6.414V10h2V3h-7z',
  'arrow-up': 'M12 4l8 8h-5v8H9v-8H4l8-8z',
  'arrow-down': 'M12 20l-8-8h5V4h6v8h5l-8 8z',
};

export function DexIcon({ name, size, style }) {
  var px = typeof size === 'number' ? size : (ICON_SIZE[size] || 16);
  var d = PATHS[name];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={style}
    >
      {d ? <path d={d} /> : null}
    </svg>
  );
}

// ─── Switch ─────────────────────────────────────────────────────────────────
export function DexSwitch({ checked, onCheckedChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      className="dex-switch"
      onClick={function() { if (!disabled && onCheckedChange) onCheckedChange(!checked); }}
      disabled={disabled}
    >
      <span data-state={checked ? 'checked' : 'unchecked'} className="dex-switch-thumb" />
    </button>
  );
}

// ─── Input ──────────────────────────────────────────────────────────────────
export function DexInput({ value, onValueChange, onChange, placeholder, size: sz, type, leading, trailing }) {
  var dense = sz === 'dense';
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: dense ? '4px 8px' : '6px 10px',
      border: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.12))',
      borderRadius: 'var(--dex-borderRadius-075, 6px)',
      background: '#fff',
      boxSizing: 'border-box',
      width: '100%',
    }}>
      {leading && (
        <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--dex-fgColor-subtle)', flexShrink: 0 }}>
          {leading}
        </span>
      )}
      <input
        type={type || 'text'}
        value={value}
        placeholder={placeholder}
        onChange={function(e) {
          if (onValueChange) onValueChange(e.target.value);
          if (onChange) onChange(e);
        }}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: dense ? 'var(--dex-fontSize-xs, 12px)' : 'var(--dex-fontSize-sm, 14px)',
          fontFamily: 'inherit',
          color: 'var(--dex-fgColor-default, #1a1a1a)',
          padding: 0,
          minWidth: 0,
          WebkitAppearance: 'none',
        }}
      />
      {value && (
        <button
          type="button"
          tabIndex={-1}
          onClick={function() { if (onValueChange) onValueChange(''); }}
          style={{
            display: 'inline-flex', alignItems: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 0, color: 'var(--dex-fgColor-subtle)', flexShrink: 0,
          }}
        >
          <DexIcon name="x-circle-fill" size="xs" />
        </button>
      )}
      {trailing && (
        <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--dex-fgColor-subtle)', flexShrink: 0 }}>
          {trailing}
        </span>
      )}
    </div>
  );
}

// ─── Tooltip ────────────────────────────────────────────────────────────────
export function DexTooltip({ content, side, children }) {
  var [visible, setVisible] = useState(false);
  var child = React.Children.only(children);
  var clone = React.cloneElement(child, {
    onMouseEnter: function(e) {
      setVisible(true);
      if (child.props.onMouseEnter) child.props.onMouseEnter(e);
    },
    onMouseLeave: function(e) {
      setVisible(false);
      if (child.props.onMouseLeave) child.props.onMouseLeave(e);
    },
  });

  var posStyle = {};
  if (side === 'right') {
    posStyle = { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 };
  } else if (side === 'bottom') {
    posStyle = { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6 };
  } else {
    posStyle = { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 };
  }

  return (
    <span style={{ position: 'relative', display: 'contents' }}>
      {clone}
      {visible && content && (
        <span style={{
          position: 'absolute',
          ...posStyle,
          zIndex: 9000,
          whiteSpace: 'nowrap',
          background: 'var(--dex-bgColor-neutral-emphasis-base, #1a1a1a)',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 500,
          padding: '4px 8px',
          borderRadius: 4,
          pointerEvents: 'none',
        }}>
          {content}
        </span>
      )}
    </span>
  );
}

// ─── Dropdown menu ──────────────────────────────────────────────────────────
export function DexDropdownMenu({ children, content, open, onOpenChange, side, align, size }) {
  var containerRef = useRef(null);
  var controlled = open !== undefined;
  var [internalOpen, setInternalOpen] = useState(false);
  var isOpen = controlled ? open : internalOpen;

  var setOpen = function(v) {
    if (!controlled) setInternalOpen(v);
    if (onOpenChange) onOpenChange(v);
  };

  // Click outside to close
  useEffect(function() {
    if (!isOpen) return;
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return function() { document.removeEventListener('mousedown', handler); };
  }, [isOpen]);

  // Compute popup position
  var popupStyle = {
    position: 'absolute',
    zIndex: 9000,
    background: '#fff',
    border: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.08))',
    borderRadius: 'var(--dex-borderRadius-100, 8px)',
    boxShadow: 'var(--dex-elevation-z2, 0 2px 8px rgba(0,0,0,0.10))',
    minWidth: 160,
  };

  var sideVal = side || 'bottom';
  var alignVal = align || 'start';

  if (sideVal === 'bottom') {
    popupStyle.top = '100%';
    popupStyle.marginTop = 4;
  } else if (sideVal === 'top') {
    popupStyle.bottom = '100%';
    popupStyle.marginBottom = 4;
  }

  if (alignVal === 'start') {
    popupStyle.left = 0;
  } else if (alignVal === 'end') {
    popupStyle.right = 0;
  } else {
    popupStyle.left = '50%';
    popupStyle.transform = 'translateX(-50%)';
  }

  var trigger = React.cloneElement(React.Children.only(children), {
    onClick: function(e) {
      setOpen(!isOpen);
      var orig = React.Children.only(children).props.onClick;
      if (orig) orig(e);
    },
  });

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {trigger}
      {isOpen && (
        <div style={popupStyle} role="menu">
          {content}
        </div>
      )}
    </div>
  );
}

export function DexDropdownMenuItem({ title, leading, selected, onSelect, children }) {
  var [hover, setHover] = useState(false);
  return (
    <div
      role="menuitem"
      onClick={onSelect}
      onMouseEnter={function() { setHover(true); }}
      onMouseLeave={function() { setHover(false); }}
      className="dex-menu-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        cursor: 'pointer',
        fontSize: 12,
        lineHeight: '16px',
        color: selected ? 'var(--dex-fgColor-primary, #006ceb)' : 'var(--dex-fgColor-default, #1a1a1a)',
        background: hover ? 'var(--dex-bgColor-primary-subtle, rgba(0,108,235,0.06))' : 'transparent',
        fontFamily: 'inherit',
        userSelect: 'none',
      }}
    >
      {leading && <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{leading}</span>}
      <span className="dex-text-body">{title || children}</span>
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────
var SIZE_MAP = { sm: 480, md: 560, lg: 720, xl: 900 };

export function DexModal({ open, onOpenChange, children }) {
  useEffect(function() {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return function() { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        padding: '24px',
        boxSizing: 'border-box',
      }}
      onMouseDown={function(e) {
        if (e.target === e.currentTarget && onOpenChange) onOpenChange(false);
      }}
    >
      {children}
    </div>
  );
}

export function DexModalContent({ children, size }) {
  var maxW = SIZE_MAP[size] || 560;
  return (
    <div style={{
      background: '#fff',
      borderRadius: 'var(--dex-borderRadius-150, 12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      width: '100%',
      maxWidth: maxW,
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

export function DexModalHeading({ title, subtitle, onClose }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: '20px 24px 0',
      flexShrink: 0,
    }}>
      <div>
        {title && (
          <div style={{
            fontSize: 'var(--dex-fontSize-lg, 18px)',
            fontWeight: 700,
            color: 'var(--dex-fgColor-highContrast, #0d0d0d)',
            lineHeight: 1.3,
          }}>{title}</div>
        )}
        {subtitle && (
          <div style={{
            fontSize: 'var(--dex-fontSize-xs, 12px)',
            color: 'var(--dex-fgColor-subtle)',
            marginTop: 2,
          }}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}

export function DexModalBody({ children }) {
  return (
    <div style={{
      padding: '0 24px 16px',
      overflowY: 'auto',
      flex: 1,
      minHeight: 0,
    }}>
      {children}
    </div>
  );
}

export function DexModalFooter({ children }) {
  return (
    <div style={{
      padding: '12px 24px 20px',
      borderTop: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.08))',
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

// ─── Button ─────────────────────────────────────────────────────────────────
var BTN_STYLES = {
  solid:   { background: 'var(--dex-fgColor-primary, #006ceb)', color: '#fff', border: 'none' },
  outline: { background: 'transparent', color: 'var(--dex-fgColor-default, #1a1a1a)', border: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.15))' },
  ghost:   { background: 'transparent', color: 'var(--dex-fgColor-default, #1a1a1a)', border: 'none' },
};
var BTN_COLOR_OVERRIDES = {
  neutral: { background: 'transparent', color: 'var(--dex-fgColor-default, #1a1a1a)', border: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.15))' },
};

export function DexButton({ children, variant, color, onClick, leadingIcon, trailingIcon, disabled, style }) {
  var base = BTN_STYLES[variant] || BTN_STYLES.solid;
  if (color && BTN_COLOR_OVERRIDES[color]) base = BTN_COLOR_OVERRIDES[color];
  var [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={function() { setHover(true); }}
      onMouseLeave={function() { setHover(false); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 'var(--dex-borderRadius-075, 6px)',
        fontSize: 'var(--dex-fontSize-sm, 14px)',
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.12s ease, opacity 0.12s ease',
        ...base,
        ...(hover && !disabled && variant === 'solid' ? { filter: 'brightness(1.08)' } : {}),
        ...style,
      }}
    >
      {leadingIcon && <DexIcon name={leadingIcon} size="sm" />}
      {children}
      {trailingIcon && <DexIcon name={trailingIcon} size="sm" />}
    </button>
  );
}

// ─── Link ────────────────────────────────────────────────────────────────────
export function DexLink({ children, href, external, trailingIcon, style }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color: 'var(--dex-fgColor-primary, #006ceb)',
        textDecoration: 'none',
        fontWeight: 500,
        ...style,
      }}
    >
      {children}
      {trailingIcon && <DexIcon name={trailingIcon} size="xs" />}
    </a>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
var CARD_ELEVATION = {
  none:   'none',
  subtle: 'var(--dex-elevation-z1, 0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04))',
  raised: 'var(--dex-elevation-z2, 0 2px 8px rgba(0,0,0,0.10))',
};

export function DexCard({ children, elevation, style }) {
  return (
    <div
      className="dex-card"
      style={{
        background: 'var(--dex-surface-flat-bgColor, #ffffff)',
        borderRadius: 'var(--dex-borderRadius-150, 12px)',
        boxShadow: CARD_ELEVATION[elevation] || CARD_ELEVATION.subtle,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div className="dex-card-content" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
