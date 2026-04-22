type PrintHtmlInput = {
  title: string;
  bodyHtml: string;
  styles: string;
};

export function printHtmlDocument(input: PrintHtmlInput) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  const cleanup = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  const printFrame = () => {
    const printWindow = iframe.contentWindow;
    if (!printWindow) {
      cleanup();
      throw new Error('Unable to open print dialog');
    }

    const onAfterPrint = () => {
      cleanup();
    };

    printWindow.addEventListener('afterprint', onAfterPrint, { once: true });
    window.setTimeout(cleanup, 15_000);
    printWindow.focus();
    printWindow.print();
  };

  const printDoc = iframe.contentDocument;
  if (!printDoc) {
    cleanup();
    throw new Error('Unable to create print document');
  }

  const markup = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
    <style>${input.styles}</style>
  </head>
  <body>${input.bodyHtml}</body>
</html>`;

  printDoc.open();
  printDoc.write(markup);
  printDoc.close();

  const printWindow = iframe.contentWindow;
  if (!printWindow) {
    cleanup();
    throw new Error('Unable to open print dialog');
  }

  const onLoaded = () => {
    // Allow a short tick so layout settles before print preview starts.
    window.setTimeout(printFrame, 40);
  };

  if (printDoc.readyState === 'complete') {
    onLoaded();
  } else {
    printWindow.addEventListener('load', onLoaded, { once: true });
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
