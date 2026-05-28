const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:4546');

ws.on('open', () => {
  console.log('🟢 Connected to gateway!');
  
  const regPacket = {
    type: 'register_custom_plcs',
    layoutId: 'vsim_custom_layout',
    plcs: [
      {
        nodeId: 'node_weld_robot',
        protocol: 'modbus',
        ip: '127.0.0.1',
        port: 5020,
        mappings: {
          cycleDuration: '%MW3',
          arcCurrent: '%IW1'
        }
      }
    ]
  };
  
  ws.send(JSON.stringify(regPacket));
  console.log('📤 Sent register packet.');
  
  // Exit after 5 seconds of telemetry observation
  setTimeout(() => {
    console.log('👋 Closing test client.');
    ws.close();
    process.exit(0);
  }, 5000);
});

ws.on('message', (data) => {
  const packet = JSON.parse(data);
  if (packet.type === 'custom_plc_telemetry') {
    console.log('📥 Telemetry:', JSON.stringify(packet.data, null, 2));
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket Error:', err);
});
