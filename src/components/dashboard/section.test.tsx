import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Section } from './section';

describe('<Section>', () => {
  it('renders title, count, and children', () => {
    render(
      <Section title="Presets" count={0} defaultExpanded>
        <p>placeholder body</p>
      </Section>,
    );
    expect(screen.getByRole('heading', { name: 'Presets' })).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('placeholder body')).toBeInTheDocument();
  });

  it('defaults defaultExpanded to false (collapsed mount)', () => {
    render(
      <Section title="My Calculators" count={3}>
        <p>hidden body</p>
      </Section>,
    );
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('defaultExpanded={true} mounts expanded', () => {
    render(
      <Section title="Presets" count={2} defaultExpanded>
        <p>visible body</p>
      </Section>,
    );
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('click toggles open/closed', () => {
    render(
      <Section title="Presets" count={0}>
        <p>body</p>
      </Section>,
    );
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('chevron rotates -90° when collapsed and 0° when expanded', () => {
    const { container } = render(
      <Section title="Presets" count={0}>
        <p>body</p>
      </Section>,
    );
    const chevWrap = container.querySelector('[aria-hidden="true"]');
    expect(chevWrap?.className).toMatch(/-rotate-90/);
    expect(chevWrap?.className).not.toMatch(/rotate-0/);

    fireEvent.click(screen.getByRole('button'));
    expect(chevWrap?.className).toMatch(/rotate-0/);
    expect(chevWrap?.className).not.toMatch(/-rotate-90/);
  });

  it('hint renders only when collapsed', () => {
    render(
      <Section title="Presets" count={0} hint="Curated by sysadmin">
        <p>body</p>
      </Section>,
    );
    expect(screen.getByText('· Curated by sysadmin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('· Curated by sysadmin')).not.toBeInTheDocument();
  });

  it('tint="danger" applies the danger wash classes', () => {
    const { container } = render(
      <Section title="User Calculators" count={1} tint="danger">
        <p>body</p>
      </Section>,
    );
    const section = container.querySelector('section');
    expect(section?.className).toMatch(/bg-cg-danger-soft/);
    expect(section?.className).toMatch(/border-cg-danger-border/);
  });

  it('no tint uses neutral surface frame', () => {
    const { container } = render(
      <Section title="Presets" count={0}>
        <p>body</p>
      </Section>,
    );
    const section = container.querySelector('section');
    expect(section?.className).toMatch(/bg-cg-surface\b/);
    expect(section?.className).toMatch(/border-cg-border/);
  });

  it('trigger button carries aria-expanded and aria-controls; content carries matching id', () => {
    const { container } = render(
      <Section title="Presets" count={0} defaultExpanded>
        <p>body</p>
      </Section>,
    );
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const controlsId = trigger.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    const content = container.querySelector(`#${controlsId}`);
    expect(content).not.toBeNull();
  });
});
