exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { audio, mimeType } = JSON.parse(event.body);

    if (!audio) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No audio data' }) };
    }

    const audioBuffer = Buffer.from(audio, 'base64');
    const ext = mimeType && mimeType.includes('mp4') ? 'm4a' : 'webm';
    const filename = `recording.${ext}`;

    // Build multipart form data manually — no external dependencies
    const boundary = '----FormBoundary' + Math.random().toString(36).substr(2);
    
    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType || 'audio/mp4'}\r\n\r\n`
    );
    
    const modelField = Buffer.from(
      `\r\n--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `whisper-1`
    );
    
    const langField = Buffer.from(
      `\r\n--${boundary}\r\n` +
      `Content-Disposition: form-data; name="language"\r\n\r\n` +
      `en`
    );
    
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    
    const body = Buffer.concat([header, audioBuffer, modelField, langField, footer]);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString()
      },
      body: body
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Whisper error:', JSON.stringify(result));
      return { statusCode: 500, body: JSON.stringify({ error: result.error?.message || 'Transcription failed' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: result.text })
    };

  } catch (err) {
    console.error('Transcribe error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
