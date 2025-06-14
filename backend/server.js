import express from 'express';
import { createServer } from 'http';
import https from 'https';
import { Server } from 'socket.io';
import mediasoup from 'mediasoup';
import { mediaCodecsWebRTC } from './mediacodecs.js';
import fs from 'fs';

const app = express();
const record = false;
const PORT = 3333;

/*
const options = {
  key: fs.readFileSync('./ssl/local-key.pem', 'utf-8'),
  cert: fs.readFileSync('./ssl/local-cert.pem', 'utf-8')
}
const httpServer = https.createServer(options, app)
*/
const httpServer =createServer(app)
httpServer.listen(PORT, '0.0.0.0',() => {
    //console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    
  });

// Configura Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    //origin: ["http://localhost:3000", "https://172.19.106.115:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  }
});

// Namespace para videollamadas
const connections = io.of('/mediasoup');

let worker
let rooms = {}          // { roomName1: { Router, rooms: [ sicketId1, ... ] }, ...}
let peers = {}          // { socketId1: { roomName1, socket, transports = [id1, id2,] }, producers = [id1, id2,] }, consumers = [id1, id2,], peerDetails }, ...}
let transports = []     // [ { socketId1, roomName1, transport, consumer }, ... ]
let producers = []      // [ { socketId1, roomName1, producer, }, ... ]
let consumers = []      // [ { socketId1, roomName1, consumer, }, ... ]

const createWorker = async () => {
    worker = await mediasoup.createWorker({
      rtcMinPort: 2000,
      rtcMaxPort: 2020
      //logLevel: 'warn',
      //logTags: ['info', 'message'],
  });
  
    worker.on('died', error => {
      console.error('mediasoup worker has died')
      setTimeout(() => process.exit(1), 2000) // exit in 2 seconds
    })
    return worker
  }

worker = createWorker()  
const mediaCodecs = mediaCodecsWebRTC



connections.on('connection', async socket => {
    console.log('new peer: ', socket.id)
    socket.emit('connection-success', {
      socketId: socket.id,
    })
    console.log("sent connection-success event")
  
    const removeItems = (items, socketId, type) => {
      items.forEach(item => {
        if (item.socketId === socket.id) {
          item[type].close()
        }
      })
      items = items.filter(item => item.socketId !== socket.id)
  
      return items
    }
  
    socket.on('disconnect', () => {
      // do some cleanup
      console.log('peer disconnected: ' + socket.id)
      consumers = removeItems(consumers, socket.id, 'consumer')
      producers = removeItems(producers, socket.id, 'producer')
      transports = removeItems(transports, socket.id, 'transport')
      const peer = peers[socket.id]
      if (record)
        stopRecord(peer)
      if (peers[socket.id] && peers[socket.id].roomName) {
        const { roomName } = peers[socket.id]
        delete peers[socket.id]
    
        // remove socket from room
        rooms[roomName] = {
          router: rooms[roomName].router,
          peers: rooms[roomName].peers.filter(socketId => socketId !== socket.id)
        }
      }
    })
  
    socket.on('joinRoom', async ({ roomName }, callback) => {
      // create Router if it does not exist
      // const router1 = rooms[roomName] && rooms[roomName].get('data').router || await createRoom(roomName, socket.id)
      console.log("Peer " + socket.id + " joined room " + roomName);
      const router1 = await createRoom(roomName, socket.id)
  
      peers[socket.id] = {
        socket,
        roomName,           // Name for the Router this Peer joined
        transports: [],
        producers: [],
        consumers: [],
        remotePorts: [],
        peerDetails: {
          name: '',
          isAdmin: false,   // Is this Peer the Admin?
        }
      }
  
      // get Router RTP Capabilities
      const rtpCapabilities = router1.rtpCapabilities
      // call callback from the client and send back the rtpCapabilities
      callback({ rtpCapabilities })
    })
  
    const createRoom = async (roomName, socketId) => {
      // worker.createRouter(options)
      // options = { mediaCodecs, appData }
      // mediaCodecs -> defined above
      // appData -> custom application data - we are not supplying any
      // none of the two are required
      let router1
      let peers = []
      if (rooms[roomName]) {
        router1 = rooms[roomName].router
        peers = rooms[roomName].peers || []
      } else {
        router1 = await worker.createRouter({ mediaCodecs, })
      }
      
      rooms[roomName] = {
        router: router1,
        peers: [...peers, socketId],
      }
  
      return router1
    }
  
    // socket.on('createRoom', async (callback) => {
    //   if (router === undefined) {
    //     // worker.createRouter(options)
    //     // options = { mediaCodecs, appData }
    //     // mediaCodecs -> defined above
    //     // appData -> custom application data - we are not supplying any
    //     // none of the two are required
    //     router = await worker.createRouter({ mediaCodecs, })
    //     console.log(`Router ID: ${router.id}`)
    //   }
  
    //   getRtpCapabilities(callback)
    // })
  
    // const getRtpCapabilities = (callback) => {
    //   const rtpCapabilities = router.rtpCapabilities
  
    //   callback({ rtpCapabilities })
    // }
  
    // Client emits a request to create server side Transport
    // We need to differentiate between the producer and consumer transports
    socket.on('createWebRtcTransport', async ({ consumer }, callback) => {
      // get Room Name from Peer's properties
      const roomName = peers[socket.id].roomName
  
      // get Router (Room) object this peer is in based on RoomName
      const router = rooms[roomName].router
  
      createWebRtcTransport(router).then(
        transport => {
          callback({
            params: {
              id: transport.id,
              iceParameters: transport.iceParameters,
              iceCandidates: transport.iceCandidates,
              dtlsParameters: transport.dtlsParameters,
              sctpParameters: transport.sctpParameters,
            }
          })
      /*
      console.log("transport " + (consumer ? "consume" : "receive") + ": " + 
        JSON.stringify({
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            sctpParameters: transport.sctpParameters
        }, null, 2)
      );
      */
          // add transport to Peer's properties
          addTransport(transport, roomName, consumer)
        },
        error => {
          console.log(error)
        })
    })
  
    const addTransport = (transport, roomName, consumer) => {
      transports = [
        ...transports,
        { socketId: socket.id, transport, roomName, consumer, }
      ]
  
      peers[socket.id] = {
        ...peers[socket.id],
        transports: [
          ...peers[socket.id].transports,
          transport.id,
        ]
      }
    }
  
    const addProducer = (producer, roomName) => {
      producers = [
        ...producers,
        { socketId: socket.id, producer, roomName, }
      ]
  
      peers[socket.id] = {
        ...peers[socket.id],
        producers: [
          ...peers[socket.id].producers,
          producer.id,
        ]
      }
    }
  
    const addConsumer = (consumer, roomName) => {
      // add the consumer to the consumers list
      consumers = [
        ...consumers,
        { socketId: socket.id, consumer, roomName, }
      ]
  
      // add the consumer id to the peers list
      peers[socket.id] = {
        ...peers[socket.id],
        consumers: [
          ...peers[socket.id].consumers,
          consumer.id,
        ]
      }
    }
  
    socket.on('getProducers', callback => {
      //return all producer transports
      const { roomName } = peers[socket.id]
  
      let producerList = []
      producers.forEach(producerData => {
        if (producerData.socketId !== socket.id && producerData.roomName === roomName) {
          producerList = [...producerList, producerData.producer.id]
        }
      })
  
      // return the producer list back to the client
      callback(producerList)
    })
  
    const informConsumers = (roomName, socketId, id) => {
      console.log(`just joined, id ${id} ${roomName}, ${socketId}`)
      // A new producer just joined
      // let all consumers to consume this producer
      producers.forEach(producerData => {
        if (producerData.socketId !== socketId && producerData.roomName === roomName) {
          const producerSocket = peers[producerData.socketId].socket
          // use socket to send producer id to producer
          producerSocket.emit('new-producer', { producerId: id })
        }
      })
      
      const peer2 = peers[socketId]
      const router2 = rooms[roomName].router
      const producerIds = peer2.producers 
      const producer2 = producers.filter(producerData => 
        producerIds.includes(producerData.producer.id)
      ).map(producerData => producerData.producer); 
      if (record) 
        startRecord(peer2, router2, producer2)
    }
  
    const getTransport = (socketId) => {
      const [producerTransport] = transports.filter(transport => transport.socketId === socketId && !transport.consumer)
      //console.log('producerTransport: ', producerTransport.socketId) 
      return producerTransport.transport
    }
  
    // see client's socket.emit('transport-connect', ...)
    socket.on('transport-connect', ({ dtlsParameters }) => {
      console.log('DTLS PARAMS... ', { dtlsParameters })
      getTransport(socket.id).connect({ dtlsParameters })
    })
  
    // see client's socket.emit('transport-produce', ...)
    socket.on('transport-produce', async ({ kind, rtpParameters, appData }, callback) => {
      // call produce based on the prameters from the client
      const producer = await getTransport(socket.id).produce({
        kind,
        rtpParameters,
      })
      // add producer to the producers array
      const { roomName } = peers[socket.id]
  
      addProducer(producer, roomName)
  
      informConsumers(roomName, socket.id, producer.id)
  
      //console.log('Producer ID: ', producer.id, producer.kind)
      producer.on('transportclose', () => {
        console.log('transport for this producer closed ')
        producer.close()
      })
  
      // Send back to the client the Producer's id
      callback({
        id: producer.id,
        producersExist: producers.length>1 ? true : false
      })
    })
  
    // see client's socket.emit('transport-recv-connect', ...)
    socket.on('transport-recv-connect', async ({ dtlsParameters, serverConsumerTransportId }) => {
      //console.log(`DTLS PARAMS: ${dtlsParameters}`)
      console.log('transport-recv-connect', serverConsumerTransportId)
      const consumerTransport = transports.find(transportData => (
        transportData.consumer && transportData.transport.id == serverConsumerTransportId
      )).transport
      await consumerTransport.connect({ dtlsParameters })
    })
  
    socket.on('consume', async ({ rtpCapabilities, remoteProducerId, serverConsumerTransportId }, callback) => {
      try {
        const { roomName } = peers[socket.id]
        const router = rooms[roomName].router
        let consumerTransport = transports.find(transportData => (
          transportData.consumer && transportData.transport.id == serverConsumerTransportId
        )).transport
  
        // check if the router can consume the specified producer
        if (router.canConsume({
          producerId: remoteProducerId,
          rtpCapabilities
        })) {
          // transport can now consume and return a consumer
          const consumer = await consumerTransport.consume({
            producerId: remoteProducerId,
            rtpCapabilities,
            paused: true,
          })
  
          consumer.on('transportclose', () => {
            console.log('transport close from consumer')
          })
  
          consumer.on('producerclose', () => {
            console.log('producer of consumer closed')
            socket.emit('producer-closed', { remoteProducerId })
  
            consumerTransport.close([])
            transports = transports.filter(transportData => transportData.transport.id !== consumerTransport.id)
            consumer.close()
            consumers = consumers.filter(consumerData => consumerData.consumer.id !== consumer.id)
          })
  
          addConsumer(consumer, roomName)
  
          // from the consumer extract the following params
          // to send back to the Client
          const params = {
            id: consumer.id,
            producerId: remoteProducerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            serverConsumerId: consumer.id,
          }
  
          // send the parameters to the client
          callback({ params })
        }
      } catch (error) {
        console.log(error.message)
        callback({
          params: {
            error: error
          }
        })
      }
    })
  
    socket.on('consumer-resume', async ({ serverConsumerId }) => {
      const { consumer } = consumers.find(consumerData => consumerData.consumer.id === serverConsumerId)
      try{
        await consumer.resume()
      } catch (error) {
        console.log(error.message)
      }
    })
  })
  
  const createWebRtcTransport = async (router) => {
    return new Promise(async (resolve, reject) => {
      try {
        // https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcTransportOptions
        const webRtcTransport_options = {
          listenInfos: [
            {
              protocol: 'udp',
              ip: '0.0.0.0',
              announcedAddress: '192.168.1.138' // replace with relevant IP address
            },
            {
              protocol: 'tcp',
              ip: '0.0.0.0',
              announcedAddress: '192.168.1.138' // replace with relevant IP address
            }
          ],
          maxIncomingBitrate: 1500000
        }
        // https://mediasoup.org/documentation/v3/mediasoup/api/#router-createWebRtcTransport
        let transport = await router.createWebRtcTransport(webRtcTransport_options)
  
  
        transport.on('dtlsstatechange', dtlsState => {
          if (dtlsState === 'closed') {
            transport.close()
          }
        })
  
        transport.on('close', () => {
          console.log('transport closed')
        })
  
        resolve(transport)
  
      } catch (error) {
        reject(error)
      }
    })
  }
