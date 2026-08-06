import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../supabase';

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (encoded3 !== 64 && encoded3 !== undefined) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (encoded4 !== 64 && encoded4 !== undefined) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return arrayBuffer;
}

/**
 * Abre la galería para seleccionar una imagen y la sube a Supabase Storage en el bucket indicado.
 * Retorna la URL pública de la imagen subida.
 */
export async function seleccionarYSubirImagen(bucket: string = 'fotos-fiestas'): Promise<string | null> {
    // Solicitar permiso de la galería
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
        throw new Error('Se requiere permiso para acceder a la galería de fotos.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
    }

    const asset = result.assets[0];
    const uri = asset.uri;

    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    let fileData: ArrayBuffer | Blob;
    if (asset.base64) {
        fileData = decodeBase64ToArrayBuffer(asset.base64);
    } else {
        const response = await fetch(uri);
        const blob = await response.blob();
        fileData = await new Response(blob).arrayBuffer();
    }

    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, fileData, {
            contentType: asset.mimeType || `image/${fileExt}`,
            upsert: true,
        });

    if (uploadError) {
        console.error('Error al subir imagen a Supabase Storage:', uploadError);
        throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

    return publicUrlData?.publicUrl || null;
}
