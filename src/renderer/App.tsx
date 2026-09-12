import type { ReactElement } from 'react';
import { APP_NAME } from '../shared/constants';

// Root application component. This is a minimal placeholder for the baseline
// scaffold; the full dictionary UI is built in later features.
export default function App(): ReactElement {
  return (
    <main className="app">
      <h1>{APP_NAME}</h1>
      <p>Offline Bangla dictionary for Windows 11.</p>
    </main>
  );
}
