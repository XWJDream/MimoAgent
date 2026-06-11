import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useConfigStore } from '../../stores/configStore';
import { SakuraDecorations } from './SakuraDecorations';

describe('SakuraDecorations', () => {
  it('renders an inaccessible decoration layer only for the sakura theme', () => {
    useConfigStore.setState((state) => ({ config: { ...state.config, theme: 'sakura' } }));
    render(<SakuraDecorations />);

    expect(screen.getByTestId('sakura-decorations')).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not render for other themes', () => {
    useConfigStore.setState((state) => ({ config: { ...state.config, theme: 'dark' } }));
    render(<SakuraDecorations />);

    expect(screen.queryByTestId('sakura-decorations')).not.toBeInTheDocument();
  });
});
