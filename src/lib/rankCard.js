const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { fetchImageBuffer } = require('./welcomeCard');

const WIDTH = 934;
const HEIGHT = 282;
const AVATAR = 170;

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatCompact(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

async function drawBackground(ctx, backgroundUrl) {
  ctx.fillStyle = '#0f1219';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (!backgroundUrl) return;

  try {
    const image = await loadImage(await fetchImageBuffer(backgroundUrl));
    const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
    ctx.fillStyle = 'rgba(8, 9, 14, 0.62)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } catch {
    ctx.fillStyle = '#0f1219';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

async function buildRankCard({ username, avatarUrl, level, rank, xpIntoLevel, xpForNextLevel, totalXp, accent, backgroundUrl }) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const color = /^#[0-9a-f]{6}$/i.test(accent || '') ? accent : '#8b7cf6';

  await drawBackground(ctx, backgroundUrl);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  roundedRect(ctx, 20, 20, WIDTH - 40, HEIGHT - 40, 22);
  ctx.fill();

  try {
    const avatar = await loadImage(await fetchImageBuffer(avatarUrl));
    const cx = 40 + AVATAR / 2 + 10;
    const cy = HEIGHT / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, AVATAR / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, cx - AVATAR / 2, cy - AVATAR / 2, AVATAR, AVATAR);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, AVATAR / 2 + 3, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.stroke();
  } catch {
    ctx.fillStyle = color;
  }

  const left = 40 + AVATAR + 50;
  const right = WIDTH - 55;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.fillStyle = color;
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(`${level}`, right, 100);
  const levelWidth = ctx.measureText(`${level}`).width;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('LEVEL', right - levelWidth - 10, 100);

  const levelLabelWidth = ctx.measureText('LEVEL').width;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(`#${rank}`, right - levelWidth - levelLabelWidth - 50, 100);
  const rankWidth = ctx.measureText(`#${rank}`).width;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('RANK', right - levelWidth - levelLabelWidth - 50 - rankWidth - 10, 100);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  let name = username;
  while (ctx.measureText(name).width > right - left - 20 && name.length > 1) name = name.slice(0, -1);
  if (name !== username) name = `${name.slice(0, -1)}…`;
  ctx.fillText(name, left, 160);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '24px sans-serif';
  ctx.fillText(`${formatCompact(xpIntoLevel)} / ${formatCompact(xpForNextLevel)} XP`, right, 160);

  const barX = left;
  const barY = 185;
  const barW = right - left;
  const barH = 36;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  roundedRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fill();

  const ratio = xpForNextLevel > 0 ? Math.min(1, xpIntoLevel / xpForNextLevel) : 0;
  const fillW = Math.max(barH, barW * ratio);
  if (ratio > 0) {
    ctx.fillStyle = color;
    roundedRect(ctx, barX, barY, fillW, barH, barH / 2);
    ctx.fill();
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '20px sans-serif';
  ctx.fillText(`${totalXp.toLocaleString()} total XP`, left, 250);

  return canvas.encode('png');
}

module.exports = { buildRankCard };
