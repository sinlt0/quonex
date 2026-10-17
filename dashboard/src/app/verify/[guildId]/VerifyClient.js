'use client';

import { useState } from 'react';
import { completeWebVerificationAction } from './actions';

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function fingerprint() {
  const parts = [];
  try {
    parts.push(navigator.platform, navigator.language, (navigator.languages || []).join(','), navigator.hardwareConcurrency, navigator.deviceMemory, navigator.maxTouchPoints);
    parts.push(screen.width, screen.height, screen.colorDepth, window.devicePixelRatio);
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date().getTimezoneOffset());
  } catch {
    parts.push('na');
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 40;
    const context = canvas.getContext('2d');
    context.textBaseline = 'top';
    context.font = '16px Arial';
    context.fillStyle = '#f60';
    context.fillRect(10, 5, 80, 25);
    context.fillStyle = '#069';
    context.fillText('Quonex verify 1.0', 4, 8);
    parts.push(canvas.toDataURL());
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
    if (info) parts.push(gl.getParameter(info.UNMASKED_VENDOR_WEBGL), gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  } catch {
    parts.push('nocanvas');
  }
  return sha256(parts.join('|'));
}

export default function VerifyClient({ token, guildName }) {
  const [state, setState] = useState({ status: 'idle', title: '', text: '' });

  async function run() {
    setState({ status: 'working', title: '', text: '' });
    try {
      const result = await completeWebVerificationAction(token, await fingerprint());
      setState({ status: result.ok ? 'done' : 'error', title: result.title, text: result.text });
    } catch {
      setState({ status: 'error', title: 'Something went wrong', text: 'Please try again.' });
    }
  }

  if (state.status === 'done') {
    return (
      <div className="space-y-2 text-center">
        <p className="text-xl font-semibold text-emerald-400">{state.title}</p>
        <p className="text-sm text-neutral-400">{state.text}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-neutral-400">
        Press the button to confirm you are a real person joining <strong className="text-neutral-200">{guildName}</strong>.
      </p>
      <button type="button" onClick={run} disabled={state.status === 'working'} className="dash-btn dash-btn-primary px-6 py-2">
        {state.status === 'working' ? 'Checking...' : 'Verify me'}
      </button>
      {state.status === 'error' && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-red-400">{state.title}</p>
          <p className="text-xs text-neutral-400">{state.text}</p>
        </div>
      )}
      <p className="text-xs text-neutral-500">
        We check your IP address for VPNs and keep a one-way hash of it and of your device so moderators can spot alt accounts. See the privacy policy for details.
      </p>
    </div>
  );
}
