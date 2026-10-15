const { createCanvas, loadImage } = require('@napi-rs/canvas');

const WIDTH = 900;
const HEIGHT = 300;
const AVATAR_SIZE = 150;

const BRAND_FROM = '#7c3aed';
const BRAND_TO = '#312e81';

async function fetchImageBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function drawDefaultBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, BRAND_FROM);
  gradient.addColorStop(1, BRAND_TO);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

async function drawCustomBackground(ctx, backgroundUrl) {
  const buffer = await fetchImageBuffer(backgroundUrl);
  const image = await loadImage(buffer);

  const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const x = (WIDTH - w) / 2;
  const y = (HEIGHT - h) / 2;
  ctx.drawImage(image, x, y, w, h);

  ctx.fillStyle = 'rgba(10, 10, 15, 0.55)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawAvatar(ctx, avatarImage, cx, cy) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, AVATAR_SIZE / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatarImage, cx - AVATAR_SIZE / 2, cy - AVATAR_SIZE / 2, AVATAR_SIZE, AVATAR_SIZE);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, AVATAR_SIZE / 2 + 3, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.stroke();
}

async function buildMemberCard({ kind, username, avatarUrl, serverName, memberCount, backgroundUrl }) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  try {
    if (backgroundUrl) {
      await drawCustomBackground(ctx, backgroundUrl);
    } else {
      drawDefaultBackground(ctx);
    }
  } catch {
    drawDefaultBackground(ctx);
  }

  const avatarBuffer = await fetchImageBuffer(avatarUrl);
  const avatarImage = await loadImage(avatarBuffer);
  const avatarCx = 115;
  const avatarCy = HEIGHT / 2;
  drawAvatar(ctx, avatarImage, avatarCx, avatarCy);

  const textX = avatarCx + AVATAR_SIZE / 2 + 40;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '28px sans-serif';
  ctx.fillText(kind === 'join' ? 'WELCOME' : 'GOODBYE', textX, 110);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  let displayName = username;
  while (ctx.measureText(displayName).width > WIDTH - textX - 40 && displayName.length > 1) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== username) displayName = `${displayName.slice(0, -1)}…`;
  ctx.fillText(displayName, textX, 165);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '24px sans-serif';
  const subtitle =
    kind === 'join' ? `Welcome to ${serverName} · Member #${memberCount}` : `Left ${serverName} · ${memberCount} members remain`;
  ctx.fillText(subtitle, textX, 205);

  return canvas.encode('png');
}

module.exports = { buildMemberCard, fetchImageBuffer };
