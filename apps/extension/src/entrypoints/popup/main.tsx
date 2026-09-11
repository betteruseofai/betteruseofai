import datasetBundle from '@betteruseofai/dataset';
import type { Dataset } from '@betteruseofai/core';
import { render } from 'preact';

import '@betteruseofai/tokens/tokens.css';
import '@betteruseofai/tokens/fonts.css';
import '@betteruseofai/tokens/components.css';
import './popup.css';

import { App } from './App.js';

const root = document.getElementById('root');
if (root) render(<App dataset={datasetBundle as unknown as Dataset} />, root);
