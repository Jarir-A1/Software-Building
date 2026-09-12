import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/renderer/App';

// Baseline component test proving the jsdom + testing-library pipeline works.
describe('App', () => {
  it('renders the WordSetu heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'WordSetu' })).toBeInTheDocument();
  });
});
