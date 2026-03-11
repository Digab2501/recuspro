export const FILE_TYPES = {
  image: ['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'],
  pdf:   ['application/pdf'],
  word:  ['application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  excel: ['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'],
};

export const ACCEPTED = '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.csv';

export const getFileType = (file) => {
  for (const [type, mimes] of Object.entries(FILE_TYPES)) {
    if (mimes.includes(file.type)) return type;
  }
  const ext = file.name.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','webp','gif','heic','heif'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['doc','docx'].includes(ext)) return 'word';
  if (['xls','xlsx','csv'].includes(ext)) return 'excel';
  return 'unknown';
};

export const getFileIcon = (type) =>
  ({ image:'🖼️', pdf:'📄', word:'📝', excel:'📊', unknown:'📎' }[type] || '📎');

const loadScript = (src) => new Promise((res, rej) => {
  if (document.querySelector(`script[src="${src}"]`)) return res();
  const s = document.createElement('script');
  s.src = src; s.onload = res; s.onerror = rej;
  document.head.appendChild(s);
});

export const imageToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload  = () => res(r.result.split(',')[1]);
  r.onerror = () => rej(new Error('Lecture échouée'));
  r.readAsDataURL(file);
});

export const imageToDataUrl = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload  = () => res(r.result);
  r.onerror = () => rej(new Error('Lecture échouée'));
  r.readAsDataURL(file);
});

export const pdfToBase64Image = async (file) => {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const ab  = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
  const page = await pdf.getPage(1);
  const vp   = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  canvas.width = vp.width; canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
};

export const pdfToPreviewDataUrl = async (file) => {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const ab  = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
  const page = await pdf.getPage(1);
  const vp   = page.getViewport({ scale: 0.8 });
  const canvas = document.createElement('canvas');
  canvas.width = vp.width; canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  return canvas.toDataURL('image/jpeg', 0.7);
};

export const wordToText = async (file) => {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
  const ab = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer: ab });
  return result.value;
};

export const excelToText = async (file) => {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const ab = await file.arrayBuffer();
  const wb = window.XLSX.read(ab, { type: 'array' });
  let text = '';
  wb.SheetNames.forEach(name => {
    text += `--- Feuille: ${name} ---\n`;
    text += window.XLSX.utils.sheet_to_csv(wb.Sheets[name]) + '\n\n';
  });
  return text;
};

export const generatePreview = async (file, fileType) => {
  try {
    if (fileType === 'image') return await imageToDataUrl(file);
    if (fileType === 'pdf')   return await pdfToPreviewDataUrl(file);
  } catch {}
  return null;
};
