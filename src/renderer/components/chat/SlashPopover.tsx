import React, { useState, useEffect, useRef } from 'react';
import { useCommandStore, SlashCommand } from '../../stores/commandStore';

interface SlashPopoverProps {
  query: string;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export function SlashPopover({ query, onSelect, onClose }: SlashPopoverProps) {
  const { search } = useCommandStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = search(query);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            onSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex, onSelect, onClose]);

  // Scroll to selected item
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (results.length === 0) {
    return (
      <div className="slash-popover">
        <div className="slash-popover-empty">未找到匹配的命令</div>
      </div>
    );
  }

  return (
    <div className="slash-popover" ref={listRef}>
      {results.map((cmd, i) => (
        <div
          key={cmd.id}
          className={`slash-popover-item ${i === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(cmd)}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className="slash-popover-trigger">{cmd.trigger}</span>
          <span className="slash-popover-title">{cmd.title}</span>
          {cmd.keybind && (
            <span className="slash-popover-keybind">{cmd.keybind}</span>
          )}
        </div>
      ))}
    </div>
  );
}
