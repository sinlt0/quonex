const STYLE_CLASSES = {
  primary: 'bg-[#5865f2] text-white',
  secondary: 'bg-[#4e5058] text-white',
  success: 'bg-[#248046] text-white',
  danger: 'bg-[#da373c] text-white',
  link: 'bg-[#4e5058] text-white'
};

function renderInline(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function Markdown({ content, small }) {
  const lines = (content || '').split('\n');
  return (
    <div className={small ? 'text-xs text-neutral-400' : 'text-sm text-neutral-200'}>
      {lines.map((line, index) => {
        const heading = line.match(/^(#{1,3})\s+(.*)$/);
        if (heading) {
          const size = heading[1].length === 1 ? 'text-xl' : heading[1].length === 2 ? 'text-lg' : 'text-base';
          return (
            <p key={index} className={`${size} font-semibold text-white`} dangerouslySetInnerHTML={{ __html: renderInline(heading[2]) }} />
          );
        }
        const subtext = line.startsWith('-# ');
        return (
          <p
            key={index}
            className={subtext ? 'text-xs text-neutral-500' : ''}
            dangerouslySetInnerHTML={{ __html: renderInline(subtext ? line.slice(3) : line) || '&nbsp;' }}
          />
        );
      })}
    </div>
  );
}

export default function Preview({ blocks, accent }) {
  const color = /^#[0-9a-fA-F]{6}$/.test(accent || '') ? accent : '#6f5de0';
  return (
    <div className="space-y-2 rounded-xl border-l-4 bg-[#1e1f22] p-4" style={{ borderLeftColor: color }}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'text':
            return <Markdown key={index} content={block.content} />;
          case 'section':
            return (
              <div key={index} className="flex items-start justify-between gap-3">
                <Markdown content={block.content} />
                {block.thumbnail && /^https?:\/\//.test(block.thumbnail) && (
                  <img src={block.thumbnail} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                )}
              </div>
            );
          case 'image':
            return (
              <div key={index} className={`grid gap-1 ${block.urls.length > 1 ? 'grid-cols-2' : ''}`}>
                {block.urls
                  .filter(url => /^https?:\/\//.test(url))
                  .map((url, i) => (
                    <img key={i} src={url} alt="" className="max-h-48 w-full rounded-lg object-cover" />
                  ))}
              </div>
            );
          case 'separator':
            return <div key={index} className={block.spacing === 'large' ? 'py-3' : 'py-1'}>{block.divider !== false && <hr className="border-white/10" />}</div>;
          case 'footer':
            return (
              <div key={index} className="space-y-1">
                <hr className="border-white/10" />
                <Markdown content={block.content} small />
              </div>
            );
          case 'buttons':
          case 'actions':
            return (
              <div key={index} className="flex flex-wrap gap-2">
                {block.buttons.map((button, i) => (
                  <span
                    key={i}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${STYLE_CLASSES[button.style || 'link']}`}
                  >
                    {button.emoji ? `${button.emoji} ` : ''}
                    {button.label || 'Button'}
                    {(button.style === 'link' || block.type === 'buttons') && ' ↗'}
                  </span>
                ))}
              </div>
            );
          case 'select':
            return (
              <div key={index} className="flex items-center justify-between rounded-md bg-[#111214] px-3 py-2 text-sm text-neutral-400">
                <span>{block.placeholder || 'Choose an option'}</span>
                <span aria-hidden="true">▾</span>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
