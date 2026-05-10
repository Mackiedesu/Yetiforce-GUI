const { crawlPageElements, generateKatalonFromElements } = require('./scanner.service');

async function scanPageHandler(req, res) {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
  } catch {
    return res.status(400).json({ error: 'url phải là địa chỉ HTTP/HTTPS hợp lệ' });
  }

  console.log(`[Scanner] Scanning: ${url}`);
  const result = await crawlPageElements(url);
  console.log(`[Scanner] Found ${result.elements.length} elements on "${result.title}"`);

  res.json(result);
}

async function generateFromScanHandler(req, res) {
  const { url, title, elements } = req.body;

  if (!url || !Array.isArray(elements) || elements.length === 0) {
    return res.status(400).json({ error: 'url và elements là bắt buộc' });
  }

  console.log(`[Scanner] Generating Katalon artifacts for ${url} (${elements.length} elements)`);
  const result = await generateKatalonFromElements({ url, title: title || url, elements });
  console.log(`[Scanner] Generated ${result.objectRepository.length} objects`);

  res.json(result);
}

module.exports = { scanPageHandler, generateFromScanHandler };
