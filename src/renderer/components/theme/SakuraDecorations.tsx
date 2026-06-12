import React from 'react';
import { useConfigStore } from '../../stores/configStore';

function Blossom({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none">
      <g stroke="currentColor" strokeWidth="1.2">
        <path d="M20 18C9 13 11 4 17 5c4 1 4 7 3 13Z" fill="currentColor" fillOpacity=".14" />
        <path d="M22 19c2-11 11-11 13-5 1 4-5 7-13 5Z" fill="currentColor" fillOpacity=".14" />
        <path d="M22 22c10 4 7 13 1 13-4 0-5-6-1-13Z" fill="currentColor" fillOpacity=".14" />
        <path d="M18 22c-6 9-14 4-12-2 1-4 7-4 12 2Z" fill="currentColor" fillOpacity=".14" />
        <circle cx="20" cy="20" r="2.6" fill="currentColor" fillOpacity=".42" />
      </g>
    </svg>
  );
}

function MimoMascot({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 180 150" fill="none">
      <ellipse cx="91" cy="137" rx="58" ry="8" fill="#f6b6c8" fillOpacity=".28" />
      <path d="M49 57C23 44 13 61 22 87c6 17 21 27 31 13" fill="#fffdfd" stroke="#d98ca4" strokeWidth="2" />
      <path d="M132 57c27-13 36 5 27 31-6 17-20 26-31 12" fill="#fffdfd" stroke="#d98ca4" strokeWidth="2" />
      <path d="M48 70c0-31 20-46 43-46s43 15 43 46v32c0 25-18 35-43 35s-43-10-43-35V70Z" fill="#fffdfd" stroke="#d98ca4" strokeWidth="2" />
      <path d="M66 37c7-9 16-13 25-13 10 0 19 4 26 13-9 7-17 8-26 2-9 6-17 5-25-2Z" fill="#ffe6ed" />
      <circle cx="75" cy="82" r="3" fill="#9f5f75" />
      <circle cx="108" cy="82" r="3" fill="#9f5f75" />
      <path d="M87 91c3 3 6 3 9 0" stroke="#9f5f75" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="66" cy="92" rx="8" ry="4" fill="#ffb9ca" fillOpacity=".55" />
      <ellipse cx="116" cy="92" rx="8" ry="4" fill="#ffb9ca" fillOpacity=".55" />
      <path d="M82 112c6 5 13 5 19 0" stroke="#ef9ab1" strokeWidth="2" strokeLinecap="round" />
      <path d="M91 24c-1-8 4-12 10-10 4 2 4 8-1 11" stroke="#d98ca4" strokeWidth="2" strokeLinecap="round" />
      <circle cx="104" cy="17" r="3" fill="#ffb9ca" />
    </svg>
  );
}

function SakuraTree() {
  return (
    <svg className="sakura-tree" viewBox="0 0 260 250" fill="none">
      <path d="M135 229c-1-57 17-75 14-123M137 178c-24-20-37-39-44-62M145 151c24-18 40-38 49-64" stroke="#b98b83" strokeWidth="11" strokeLinecap="round" />
      <g fill="#ffd7e3" stroke="#f29ab5" strokeWidth="1.2">
        <circle cx="80" cy="86" r="40" /><circle cx="116" cy="64" r="46" /><circle cx="157" cy="69" r="48" />
        <circle cx="194" cy="93" r="38" /><circle cx="113" cy="104" r="45" /><circle cx="158" cy="112" r="44" />
      </g>
      <g fill="#fff0f5" opacity=".85">
        <circle cx="70" cy="75" r="13" /><circle cx="104" cy="50" r="17" /><circle cx="148" cy="50" r="14" />
        <circle cx="185" cy="80" r="15" /><circle cx="120" cy="103" r="17" /><circle cx="168" cy="105" r="15" />
      </g>
      <path d="M57 232c54-10 105-9 153 0" stroke="#f3b0c4" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 7" />
    </svg>
  );
}

export function SakuraDecorations() {
  const theme = useConfigStore((state) => state.config.theme);
  if (theme !== 'sakura') return null;

  return (
    <div className="sakura-decorations" aria-hidden="true" data-testid="sakura-decorations">
      <div className="sakura-top-garland">
        {Array.from({ length: 12 }, (_, index) => <Blossom key={index} />)}
      </div>
      <div className="sakura-branch">
        <span />
        <Blossom /><Blossom /><Blossom /><Blossom /><Blossom />
      </div>
      <MimoMascot className="sakura-mascot sakura-mascot-sidebar" />
      <MimoMascot className="sakura-mascot sakura-mascot-inspector" />
      <SakuraTree />
      {Array.from({ length: 11 }, (_, index) => (
        <span key={index} className={`sakura-falling-petal petal-${index + 1}`} />
      ))}
      <Blossom className="sakura-corner-flower" />
    </div>
  );
}
