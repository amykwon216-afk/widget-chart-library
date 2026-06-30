import React, { useState, useRef } from 'react';
import { DexCard } from '@thryvlabs/dex-react';

// A flex-item widget chrome. Fills its parent slot (width: 100%, height: 100%).
export default function WidgetFrame({
  isActive = false,
  isDimmed = false,
  isAskAiTarget = false,
  panelFocusable = false,
  onPanelClick,
  children,
}) {
  const rootRef = useRef();
  const [isHovered, setIsHovered] = useState(false);

  function onMouseLeave() { setIsHovered(false); }
  function onMouseEnter() { setIsHovered(true); }

  function onClick(e) {
    if (!panelFocusable || !onPanelClick) return;
    if (e.target.closest('button, [role="button"], input, select, [role="menuitem"], [role="option"], [role="listbox"]')) return;
    onPanelClick();
  }

  const cursor = (panelFocusable && isHovered) ? 'pointer' : 'default';

  return (
    <div
      ref={rootRef}
      className="widget-frame"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor,
        userSelect: isActive ? 'none' : 'auto',
        opacity: isDimmed ? 0.35 : 1,
        transition: isActive ? 'none' : 'opacity 0.12s ease, box-shadow 0.25s ease',
        boxShadow: isActive
          ? '0 12px 28px rgba(0,0,0,0.18)'
          : isAskAiTarget
          ? '0 0 0 2px var(--dex-fgColor-primary, #006ceb), 0 8px 24px rgba(0,108,235,0.18)'
          : (panelFocusable && isHovered)
          ? '0 0 0 2px rgba(0,108,235,0.28)'
          : 'none',
        borderRadius: (isAskAiTarget || (panelFocusable && isHovered)) ? 12 : undefined,
        zIndex: isActive ? 100 : 1,
      }}
    >
      <DexCard elevation="subtle" style={{ width: '100%', height: '100%' }}>
        {children}
      </DexCard>
    </div>
  );
}
