import { useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import * as mediasoupClient from 'mediasoup-client';
import { paramsVideo } from './assets/params';
import MediaElement from './MediaElement';

function App() {
  const [socketId, setSocketId] = useState('');
  const localVideoRef = useRef(null);
  const deviceRef = useRef(null);
  const [rtpCapabilities, setRtpCapabilities] = useState(null);
  const videoParams = useRef(null);
  const audioParams = useRef(null);
  const consumerTransports = useRef([]);
  const consumingTransports = useRef([]);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const videoContainerRef = useRef(null);


  useEffect(() => {
    socket.on('connection-success', (data) => {
      console.log('Conexión exitosa:', data);
      setSocketId(data.socketId);
      getLocalStream(); // Llamamos para obtener el stream local
    });

    socket.on('new-producer', ({ producerId }) => {
      console.log('Nuevo productor:', producerId);
      signalNewConsumerTransport(producerId);
    });

    socket.on('producer-closed', ({ remoteProducerId }) => {
      console.log('producer-closed')
      // server notification is received when a producer is closed
      // we need to close the client-side consumer and associated transport
      const producerToClose = consumerTransports.current.find(transportData => transportData.producerId === remoteProducerId)
      if (!producerToClose) return;
      producerToClose.consumerTransport.close()
      producerToClose.consumer.close()
    
      // remove the consumer transport from the list
      consumerTransports.current = consumerTransports.current.filter(
        (transportData) => transportData.producerId !== remoteProducerId
      );

    })

    return () => {
      socket.off('connection-success');
      socket.off('new-producer');
    };
  }, []);

  useEffect(() => {
    if (rtpCapabilities) {
      createDevice();
    }
  }, [rtpCapabilities]);


  const getLocalStream = () => {
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: 1280, height: 720 },
      })
      .then(streamSuccess)
      .catch((error) => {
        console.error('Error al obtener el stream:', error);
      });
  };

  const streamSuccess = (stream) => {
    /*
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    */
    localVideo.srcObject = stream;
    localVideo.play().then(() => {
      console.log('El video está reproduciéndose correctamente');
    }).catch((err) => {
      console.error('Error al intentar reproducir el video:', err);
    });
  
    videoParams.current = { paramsVideo} ;
    videoParams.current = { track: stream.getVideoTracks()[0], ...videoParams.current };
    audioParams.current = { track: stream.getAudioTracks()[0] };
    joinRoom(stream);
  };

  const joinRoom = (stream) => {
    socket.emit('joinRoom', { roomName: 'room1' }, (data) => {
      setRtpCapabilities(data.rtpCapabilities);
    });
  };

  const createDevice = async () => {
    try {
      const newDevice = new mediasoupClient.Device();
      await newDevice.load({
        routerRtpCapabilities: rtpCapabilities,
      });
      deviceRef.current = newDevice;
      createSendTransport(); 
    } catch (error) {
      console.error('Error creando el dispositivo:', error);
    }
  };

  const createSendTransport = () => {
    socket.emit('createWebRtcTransport', { consumer: false }, ({ params }) => {
      if (params.error) {
        console.error('Error al crear el transport:', params.error);
        return;
      }
      const producerTransport = deviceRef.current.createSendTransport(params);
      producerTransport.on('connect', handleTransportConnect);
      producerTransport.on('produce', handleTransportProduce);
      connectSendTransport(producerTransport);
    });
  };

  const handleTransportConnect = async ({ dtlsParameters }, callback, errback) => {
    try {
      await socket.emit('transport-connect', { dtlsParameters });
      callback();
    } catch (error) {
      errback(error);
    }
  };

  const handleTransportProduce = async (parameters, callback, errback) => {
    try {
      await socket.emit('transport-produce', parameters, ({ id, producersExist }) => {
        callback({ id });
        if (producersExist) {
          getProducers();
        }
      });
    } catch (error) {
      errback(error);
    }
  };

  const connectSendTransport = async (producerTransport) => {
    // Aquí se conectan los transportes de producción de audio y video
    // Se usa el producerTransport para enviar los medios
    /*
    const audioProducer = await producerTransport.produce(audioParams.current);  
    audioProducer.on('trackended', () => {
      console.log('audio track ended')
      // close audio track
    })

    audioProducer.on('transportclose', () => {
      console.log('audio transport ended')
      // close audio track
    })
    */
    const videoProducer = await producerTransport.produce(videoParams.current);
    videoProducer.on('trackended', () => {
      console.log('video track ended')
      // close video track
    })

    videoProducer.on('transportclose', () => {
      console.log('video transport ended')
      // close video track
    })
  };

  const getProducers = () => {
    socket.emit('getProducers', (producerIds) => {
      producerIds.forEach((id) => signalNewConsumerTransport(id));
    });
  };

  const signalNewConsumerTransport = (remoteProducerId) => {
    if (consumingTransports.current.includes(remoteProducerId)) return;
    consumingTransports.current = [...consumingTransports.current, remoteProducerId];

    socket.emit('createWebRtcTransport', { consumer: true }, ({ params }) => {
      if (params.error) {
        console.error('Error al crear el transporte para consumidor:', params.error);
        return;
      }
      const consumerTransport = deviceRef.current.createRecvTransport(params);
      consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          // Signal local DTLS parameters to the server side transport
          // see server's socket.on('transport-recv-connect', ...)
          await socket.emit('transport-recv-connect', {
            dtlsParameters,
            serverConsumerTransportId: params.id,
          })
          //console.log('transport-recv-connect')
          // Tell the transport that parameters were transmitted.
          callback()
        } catch (error) {
          // Tell the transport that something was wrong
          errback(error)
        }
      })
      connectRecvTransport(consumerTransport, remoteProducerId, params.id);
    });
  };

  const connectRecvTransport = async (consumerTransport, remoteProducerId, serverConsumerTransportId) => {
    // Consumir medios remotos y agregar el video al DOM
    await socket.emit('consume', {
      rtpCapabilities: deviceRef.current.rtpCapabilities,
      remoteProducerId,
      serverConsumerTransportId,
    }, async ({ params }) => {
      //console.log('consume')
      if (params.error) {
        console.log('Cannot Consume')
        return
      }
  
      //console.log(`Consumer Params2 ${params}`)
      // then consume with the local consumer transport
      // which creates a consumer
      const consumer = await consumerTransport.consume({
        id: params.id,
        producerId: params.producerId,
        kind: params.kind,
        rtpParameters: params.rtpParameters
      })
  
      consumerTransports.current = [
        ...consumerTransports.current,
        {
          consumerTransport,
          serverConsumerTransportId: params.id,
          producerId: remoteProducerId,
          consumer,
        },
      ];
      const { track } = consumer
      const newStream = new MediaStream([track]);
      setRemoteStreams(prev => [
      ...prev,
      {
        id: remoteProducerId,
        kind: params.kind,
        stream: newStream
      }
    ]);
      socket.emit('consumer-resume', { serverConsumerId: params.serverConsumerId })
      console.log("consumer => ", consumer)
  
    });
  };

    return (
  <div id="video">
    <table className="mainTable">
      <tbody>
        <tr>
          <td className="localColumn">
            <video 
              ref={localVideoRef} 
              id="localVideo" 
              autoPlay 
              className="video" 
              muted 
              playsInline
            ></video>
          </td>
        </tr>
      </tbody>
    </table>

    {/* Tabla para mostrar los usuarios remotos */}
    <table>
      <tbody>
        <tr>
          <td>
            <div id="remote-streams-container">
              {remoteStreams.map(({ id, stream, kind }) => (
                <div
                  key={id}
                  style={{
                    display: 'inline-block',
                    margin: '10px',
                    textAlign: 'center'
                  }}
                >
                  {kind === 'video' ? (
                    <video
                      autoPlay
                      playsInline
                      style={{ width: '300px', height: '200px', backgroundColor: 'black' }}
                      ref={(el) => {
                        if (el) el.srcObject = stream;
                      }}
                    />
                  ) : (
                    <audio
                      autoPlay
                      controls
                      ref={(el) => {
                        if (el) el.srcObject = stream;
                      }}
                    />
                  )}
                  <div>Producer: {id}</div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);
}

export default App;
