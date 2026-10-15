let stream = null;

export async function encenderCamara(video) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no permite usar la cámara. Use Chrome o Safari actualizados.');
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
  } catch (e) {
    if (e.name === 'NotAllowedError') throw new Error('Permiso de cámara denegado. Habilítelo en la configuración del navegador.');
    if (e.name === 'NotFoundError') throw new Error('No se encontró una cámara en este dispositivo.');
    throw new Error('No fue posible activar la cámara.');
  }
  video.srcObject = stream;
  await video.play();
}

export function apagarCamara(video) {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  if (video) video.srcObject = null;
}

export async function capturarFoto(video, { ladoMax = 720, calidad = 0.75 } = {}) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error('La cámara aún no está lista, intente de nuevo');
  const escala = Math.min(1, ladoMax / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * escala);
  canvas.height = Math.round(h * escala);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', calidad));
  if (!blob) throw new Error('No se pudo procesar la foto, intente de nuevo');
  return blob;
}