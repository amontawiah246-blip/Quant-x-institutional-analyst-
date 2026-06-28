import WebSocket from 'ws';
const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
ws.on('open', () => {
    ws.send(JSON.stringify({
        ticks: ["frxEURUSD", "cryBTCUSD"],
        subscribe: 1
    }));
});
ws.on('message', (msg) => {
    console.log(msg.toString());
    ws.close();
});
