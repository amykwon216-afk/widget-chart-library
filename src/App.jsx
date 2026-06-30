import React from 'react';
import { DexProvider, DexTooltipProvider, DexNotificationProvider, DexNotificationViewport } from '@thryvlabs/dex-react';
import '@thryvlabs/dex-react/dist/style.css';
import { tokens } from './styles/tokens.js';
import ChartGallery from './gallery/ChartGallery.jsx';

export default function App() {
  return (
    <DexProvider defaultLanguage="en">
      <DexTooltipProvider>
        <DexNotificationProvider>
          <DexNotificationViewport />
        <style>{`
          @keyframes cardAppear { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
          @keyframes heroIn { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
          .widget-frame .dex-card { height: 100%; display: flex; flex-direction: column; }
          .widget-frame .dex-card-content { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 0 !important; }
          .dex-tooltip { padding: 6px 8px !important; border-radius: 4px !important; line-height: 1 !important; }
          .dex-menu-item { padding: 6px 12px !important; gap: 8px !important; }
          .dex-menu-item .dex-text-body { font-size: 12px !important; line-height: 16px !important; }
          .dex-menu-item svg { width: 16px !important; height: 16px !important; }
          body { margin: 0; background: var(--dex-bgColor-canvas, #f5f5f7); font-family: ${tokens.typography.fontFamily.sans}; }
          .dex-notification-viewport { top: var(--dex-spacing-200) !important; bottom: auto !important; }
        `}</style>
          <ChartGallery />
        </DexNotificationProvider>
      </DexTooltipProvider>
    </DexProvider>
  );
}
