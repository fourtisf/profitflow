'use client';
import { useState } from 'react';
import { fmtUsd, fullUsd } from '@profitflow/shared';
import { mono, sans } from '../lib/fonts';
import { SITE_HOST } from '../lib/site';

interface Example {
  tkr: string;
  pnl: number;
  mult: number;
  inN: number;
  outN: number;
  wal: string;
}

const EXAMPLES: Example[] = [
  { tkr: '$GIGA', pnl: 628200, mult: 49.3, inN: 13000, outN: 641200, wal: 'Kd4m…8sQe' },
  { tkr: '$WIF', pnl: 1240000, mult: 222, inN: 5600, outN: 1245600, wal: '3fTz…9bRc' },
  { tkr: '$POPCAT', pnl: 312800, mult: 38.2, inN: 8400, outN: 321200, wal: 'Ap7k…2vNw' },
  { tkr: '$MOODENG', pnl: 94300, mult: 12.7, inN: 8050, outN: 102350, wal: '9xQk…7mPa' },
  { tkr: '$PNUT', pnl: 476900, mult: 64.5, inN: 7500, outN: 484400, wal: '7nBv…5xLt' },
];

function roundRect(
  x: CanvasRenderingContext2D,
  a: number,
  b: number,
  w: number,
  h: number,
  r: number,
): void {
  x.beginPath();
  x.moveTo(a + r, b);
  x.arcTo(a + w, b, a + w, b + h, r);
  x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r);
  x.arcTo(a, b, a + w, b, r);
  x.closePath();
}

export function Share() {
  const [cur, setCur] = useState<Example>(EXAMPLES[0]!);
  const [label, setLabel] = useState('↓ Download PNG');

  async function drawCard(): Promise<HTMLCanvasElement> {
    if (document.fonts?.ready) await document.fonts.ready;
    const monoFam = `"${mono.style.fontFamily}"`;
    const sansFam = `"${sans.style.fontFamily}"`;
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1080;
    const x = c.getContext('2d');
    if (!x) throw new Error('no 2d context');

    x.fillStyle = '#08090a';
    x.fillRect(0, 0, 1080, 1080);
    x.fillStyle = '#0c0d0f';
    roundRect(x, 60, 60, 960, 960, 44);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,.12)';
    x.lineWidth = 2;
    roundRect(x, 60, 60, 960, 960, 44);
    x.stroke();

    x.textBaseline = 'middle';
    x.textAlign = 'left';
    x.fillStyle = '#5fd39a';
    x.beginPath();
    x.arc(132, 158, 9, 0, 7);
    x.fill();
    x.fillStyle = '#fafafa';
    x.font = `600 36px ${sansFam}`;
    x.fillText('ExitRadar', 156, 160);
    x.textAlign = 'right';
    x.fillStyle = '#71717a';
    x.font = `500 22px ${monoFam}`;
    x.fillText('REALIZED', 960, 160);
    x.textAlign = 'left';

    x.fillStyle = '#a1a1aa';
    x.font = `500 44px ${monoFam}`;
    x.fillText(cur.tkr, 120, 560);

    const txt = '+' + fullUsd(cur.pnl);
    let fs = 148;
    x.font = `600 ${fs}px ${monoFam}`;
    while (x.measureText(txt).width > 820 && fs > 64) {
      fs -= 4;
      x.font = `600 ${fs}px ${monoFam}`;
    }
    x.fillStyle = '#5fd39a';
    x.fillText(txt, 118, 672);

    x.fillStyle = '#3f8f69';
    x.font = `500 38px ${monoFam}`;
    x.fillText(cur.mult.toFixed(1) + '× return', 122, 752);
    x.fillStyle = '#71717a';
    x.font = `400 32px ${monoFam}`;
    x.fillText('in ' + fmtUsd(cur.inN) + '   →   out ' + fmtUsd(cur.outN), 120, 838);

    x.strokeStyle = 'rgba(255,255,255,.10)';
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(120, 910);
    x.lineTo(960, 910);
    x.stroke();

    x.fillStyle = '#71717a';
    x.font = `400 30px ${monoFam}`;
    x.fillText(cur.wal, 120, 968);
    x.textAlign = 'right';
    x.fillStyle = '#4b4d52';
    x.fillText(SITE_HOST, 960, 968);
    return c;
  }

  async function download(): Promise<void> {
    setLabel('Rendering…');
    try {
      const canvas = await drawCard();
      canvas.toBlob((blob) => {
        if (!blob) {
          setLabel('↓ Download PNG');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exitradar-' + cur.tkr.replace('$', '') + '.png';
        a.click();
        URL.revokeObjectURL(url);
        setLabel('↓ Download PNG');
      });
    } catch {
      setLabel('↓ Download PNG');
    }
  }

  return (
    <section id="share">
      <div className="wrap">
        <div className="share-grid">
          <div className="share-copy rv in">
            <div className="kicker">Built to spread</div>
            <h2>One screenshot does the marketing.</h2>
            <p>
              Every big exit becomes a clean, branded card. Your users post it, their followers ask
              what it is — and the feed grows itself.
            </p>
            <div className="share-btns">
              <button
                className="btn btn-o"
                type="button"
                onClick={() => setCur(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]!)}
              >
                ↻ Shuffle
              </button>
              <button className="btn btn-w" type="button" onClick={() => void download()}>
                {label}
              </button>
            </div>
          </div>
          <div className="share-stage rv in">
            <div className="scard">
              <div className="sc-top">
                <span className="sc-logo">
                  <span className="dot" /> ExitRadar
                </span>
                <span className="sc-badge">REALIZED</span>
              </div>
              <div className="sc-main">
                <div className="sc-tkr">{cur.tkr}</div>
                <div className="sc-pnl">+{fullUsd(cur.pnl)}</div>
                <div className="sc-mult">{cur.mult.toFixed(1)}× return</div>
                <div className="sc-flow">
                  <span>in {fmtUsd(cur.inN)}</span>
                  <span className="sc-arr">→</span>
                  <span>out {fmtUsd(cur.outN)}</span>
                </div>
              </div>
              <div className="sc-foot">
                <span>{cur.wal}</span>
                <span>{SITE_HOST}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
