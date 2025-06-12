export const mediaCodecsWebRTC = [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
    
  {
      kind: 'audio',
      mimeType: 'audio/G722',
      preferredPayloadType: 9,
      clockRate: 8000,
      channels: 1
    },
  
  {
      kind: 'audio',
      mimeType: 'audio/PCMU',
      preferredPayloadType: 0,
      clockRate: 8000,
  channels: 1
    },
  
  {
      kind: 'audio',
      mimeType: 'audio/PCMA',
      preferredPayloadType: 8,
      clockRate: 8000,
      channels: 1
    },
  
  {
      kind: 'audio',
      mimeType: 'audio/CN',
      preferredPayloadType: 13,
      clockRate: 8000
    },
  {
      kind: 'audio',
      mimeType: 'audio/telephone-event',
      clockRate: 48000,
      preferredPayloadType: 110
    },
  {
      kind: 'audio',
      mimeType: 'audio/telephone-event',
      clockRate: 8000,
      preferredPayloadType: 126
    },
    {
      kind: 'video',
      mimeType: 'video/h264',
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
        'x-google-start-bitrate': 1000
      }
    },
  ]