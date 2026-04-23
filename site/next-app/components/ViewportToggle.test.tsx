import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ViewportToggle, VIEWPORT_DIMENSIONS } from './ViewportToggle';

describe('ViewportToggle (multi-select)', () => {
  describe('rendering', () => {
    it('renders a group with two toggle buttons using aria-pressed', () => {
      render(<ViewportToggle value={['desktop']} onChange={() => {}} />);
      const group = screen.getByRole('group', { name: /capture viewports/i });
      expect(group).toBeInTheDocument();
      const desktop = screen.getByRole('button', { name: 'Desktop' });
      const mobile = screen.getByRole('button', { name: 'Mobile' });
      expect(desktop).toHaveAttribute('aria-pressed', 'true');
      expect(mobile).toHaveAttribute('aria-pressed', 'false');
    });

    it('exports the canonical width/height mapping per Agent API OpenAPI', () => {
      expect(VIEWPORT_DIMENSIONS.mobile).toEqual({ width: 375, height: 812 });
      expect(VIEWPORT_DIMENSIONS.desktop).toEqual({ width: 1200, height: 800 });
    });

    it('renders both aria-pressed=true when both are selected', () => {
      render(
        <ViewportToggle value={['mobile', 'desktop']} onChange={() => {}} />,
      );
      expect(screen.getByRole('button', { name: 'Mobile' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Desktop' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  describe('activating an inactive option', () => {
    it('adds it to the selection, preserving canonical order (mobile, desktop)', () => {
      const onChange = vi.fn();
      render(<ViewportToggle value={['desktop']} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(['mobile', 'desktop']);
    });

    it('works regardless of click order', () => {
      const onChange = vi.fn();
      render(<ViewportToggle value={['mobile']} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Desktop' }));
      expect(onChange).toHaveBeenCalledWith(['mobile', 'desktop']);
    });
  });

  describe('deactivating an active option', () => {
    it('removes it when another is still selected', () => {
      const onChange = vi.fn();
      render(
        <ViewportToggle
          value={['mobile', 'desktop']}
          onChange={onChange}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
      expect(onChange).toHaveBeenCalledWith(['desktop']);
    });

    it('refuses to deselect the only-active option (at-least-one invariant)', () => {
      const onChange = vi.fn();
      render(<ViewportToggle value={['desktop']} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Desktop' }));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('disabled', () => {
    it('sets both buttons disabled and blocks clicks', () => {
      const onChange = vi.fn();
      render(
        <ViewportToggle
          value={['desktop']}
          onChange={onChange}
          disabled={true}
        />,
      );
      const desktop = screen.getByRole('button', { name: 'Desktop' });
      const mobile = screen.getByRole('button', { name: 'Mobile' });
      expect(desktop).toBeDisabled();
      expect(mobile).toBeDisabled();
      fireEvent.click(mobile);
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
