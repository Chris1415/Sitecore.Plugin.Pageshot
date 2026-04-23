import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  HEIGHT_PRESET_LABELS,
  HEIGHT_PRESET_PIXELS,
  HeightToggle,
} from './HeightToggle';

describe('HeightToggle', () => {
  describe('rendering', () => {
    it('renders a radiogroup with all four preset radios', () => {
      render(<HeightToggle value="large" onChange={() => {}} />);
      const group = screen.getByRole('radiogroup', { name: /capture height/i });
      expect(group).toBeInTheDocument();
      expect(screen.getAllByRole('radio')).toHaveLength(4);
    });

    it('marks the active preset via aria-checked and tabIndex', () => {
      render(<HeightToggle value="medium" onChange={() => {}} />);
      const medium = screen.getByRole('radio', { name: /medium/i });
      const large = screen.getByRole('radio', { name: /large/i });
      expect(medium).toHaveAttribute('aria-checked', 'true');
      expect(medium).toHaveAttribute('tabIndex', '0');
      expect(large).toHaveAttribute('aria-checked', 'false');
      expect(large).toHaveAttribute('tabIndex', '-1');
    });

    it('exports the numeric mapping Agent API expects', () => {
      expect(HEIGHT_PRESET_PIXELS.small).toBe(800);
      expect(HEIGHT_PRESET_PIXELS.medium).toBe(2000);
      expect(HEIGHT_PRESET_PIXELS.large).toBe(4000);
      expect(HEIGHT_PRESET_PIXELS.full).toBe(8000);
    });

    it('exports human-readable labels for the UI', () => {
      expect(HEIGHT_PRESET_LABELS.full).toBe('Full');
    });
  });

  describe('click', () => {
    it('fires onChange with the clicked preset', () => {
      const onChange = vi.fn();
      render(<HeightToggle value="large" onChange={onChange} />);
      fireEvent.click(screen.getByRole('radio', { name: /small/i }));
      expect(onChange).toHaveBeenCalledWith('small');
    });
  });

  describe('keyboard navigation', () => {
    it('ArrowRight advances to next preset and fires onChange', () => {
      const onChange = vi.fn();
      render(<HeightToggle value="small" onChange={onChange} />);
      const small = screen.getByRole('radio', { name: /small/i });
      small.focus();
      fireEvent.keyDown(small, { key: 'ArrowRight' });
      expect(onChange).toHaveBeenCalledWith('medium');
    });

    it('ArrowLeft on first preset wraps to last', () => {
      const onChange = vi.fn();
      render(<HeightToggle value="small" onChange={onChange} />);
      const small = screen.getByRole('radio', { name: /small/i });
      small.focus();
      fireEvent.keyDown(small, { key: 'ArrowLeft' });
      expect(onChange).toHaveBeenCalledWith('full');
    });

    it('Home / End jump to first / last', () => {
      const onChange = vi.fn();
      render(<HeightToggle value="medium" onChange={onChange} />);
      const medium = screen.getByRole('radio', { name: /medium/i });
      medium.focus();
      fireEvent.keyDown(medium, { key: 'End' });
      expect(onChange).toHaveBeenLastCalledWith('full');
      fireEvent.keyDown(medium, { key: 'Home' });
      expect(onChange).toHaveBeenLastCalledWith('small');
    });
  });

  describe('disabled', () => {
    it('disables every radio and ignores click / keyboard changes', () => {
      const onChange = vi.fn();
      render(
        <HeightToggle value="large" onChange={onChange} disabled={true} />,
      );
      for (const radio of screen.getAllByRole('radio')) {
        expect(radio).toBeDisabled();
      }
      fireEvent.click(screen.getByRole('radio', { name: /small/i }));
      const active = screen.getByRole('radio', { name: /large/i });
      active.focus();
      fireEvent.keyDown(active, { key: 'ArrowRight' });
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
