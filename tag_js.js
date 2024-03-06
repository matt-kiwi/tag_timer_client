const net = require("net");
const mqtt = require('mqtt');

const tag_host = "192.168.1.50";
const tag_port = 7000;

const mqtt_host = '10.10.10.159';
const mqtt_port = '1883';
const mqtt_url = 'mqtt://10.10.10.159';
const mqtt_opts = { 
    clientId: 'tagTimerClient',
    clean: true,
    connectTimeout: 4000,
    username: 'matt',
    password: 'princess2023',
    reconnectPeriod: 1000};

const mqttClient = mqtt.connect(mqtt_url,mqtt_opts);

mqttClient.on('connect', () => {
    writeLog('MQTT Connected to '+mqtt_url);
    mqttClient.subscribe("tag545/command");
});

mqttClient.on("message", processMqttCommand );

function processMqttCommand(topic,payload){
    var commandString =  payload.toString();
    var commandProcessed = false;
    try {
        var command = JSON.parse( commandString );
    } catch(e) {
        writeLog("Unable to parse command: "+commandString);
        return;
    }
    var instuction = String(command.command).trim().toUpperCase();

    if( instuction == 'SN'){
        getSerialNumber();
        writeLog("Command: get serial number");
        commandProcessed = true;
    }

    if( instuction == "PRINT"){
        var text = command.text;
        writeLog("Command: print text="+text);
        printLine( text );
        commandProcessed = true;
    }
    if( commandProcessed==false ){
        writeLog("Unable to process command: "+ instuction);
    }
    
}

const batteryStatusDelaySeconds = 120;
const watchDogTimeSeconds = 15;
var lastKeepAlive = 0;

var client;

makeConnection();
setInterval( getBatteryStatus,batteryStatusDelaySeconds*1000);
setInterval( tagWatchDog, watchDogTimeSeconds*1000);

function makeConnection(){
    client = net.createConnection(tag_port, tag_host, () => {
        writeLog("TAG545 Connected to: "+tag_host);
    });
    
    client.on("data", (data) => {
        lastKeepAlive = Date.now();
        data = String(data).trim();
        if( String(data).length > 5){
            var lines = String(data).split('\n');
            lines.forEach( processTagData );
        }
    });
    
    client.on("error", (error) => {
        writeLog(`Error: ${error.message}`);
    });
    
    client.on("close", () => {
        writeLog("Connection closed");
    });    
}

function tagWatchDog(){
    const now = Date.now();
    var ltSeconds = ( parseInt(now - lastKeepAlive)/1000);
    if( ltSeconds > watchDogTimeSeconds ){
        writeLog("Watchdog error connection to TAG down, attempt reconnect");
        client.destroy();
        setTimeout( makeConnection,2000 );
    }
}

function getBatteryStatus(){
    // Write command 025 : Power supply status
    client.write("#RP_025\n");
}

function getSerialNumber(){
    // #SN Get serial number + device type
    client.write("#SN\n");
}

function printLine( buffer ){
    buffer = String(buffer).trim();
    client.write("#PL "+buffer+"                          \n");
}

function processTagData( line ){
    line = String(line).trim();
    var tagResponse = { type: false, line: line };
    var logLine = false;
    if( String(line).startsWith('AK C') ){
        tagResponse.type = 'ACK';
    }

/*  TAG New time 
    Time (TN, T-, T*, T+, T=, TC, TI):
    <S>Tx_NNNN_SSSS_CC_HH:MM:SS.FFFFF_DDDDD<E>
    N = Candidate number (0 – 9999)
    S = Sequential number (0 – 9999)
    C = Channel number (1 - 99) in case of manual entry (M1 – M4)
    H = Hours (0 – 23)
    M = Minutes (0 – 59)
    S = Seconds (0 – 59)
    F = decimal part (0 – 99999)
    D = Days (0 – 32767) counting from 01.01.2000
    Example: TN         4 M1  8:35:09.75300  8830
*/
    if( String(line).startsWith('TN ') ){
        const match = line.match(/^TN\s+(?<seq>\d+)\s+(?<channel>\w+)\s+(?<timestamp>[^\s]+)\s+(?<days>\d+)/);
        if( match ){
            tagResponse.type = 'TN';
            tagResponse.sequence = match.groups['seq'];
            tagResponse.channel = match.groups['channel'];
            tagResponse.timestamp = match.groups['timestamp'];
            tagResponse.days = match.groups['days'];
            logLine = true;
        }
    }

/* TAG New Speed
    Speed (VE):
    <S>VE_I_NNNN_SSS.SSS_UUUUUUU<E>
    I = Speed number
    N = Candidate number (1 – 9999)
    S = Speed (0.000 – 999.999)
    U = Speed unit (Text 7 bytes)
    Example: VE 1    0 366.551 km/h
*/
    if( String(line).startsWith('VE ') ){
        const match = line.match(/^VE\s+(?<snumber>\d+)\s+(?<candidate>\w+)\s+(?<speed>[^\s]+)\s+(?<unit>\w+)/);
        if( match ){
            tagResponse.type = 'VE';
            tagResponse.snumber = match.groups['snumber'];
            tagResponse.candidate = match.groups['candidate'];
            tagResponse.speed = match.groups['speed'];
            tagResponse.unit = match.groups['unit'];
            logLine = true;
        }
    }

/*
    025 : Power supply status
    #RP_025
    &P_025_XX_YYY_ZZZ
    X = Status register (Hex format)
    Y = Battery voltage (0.1V step)
    Z = Battery level in % (0-100)
    For CP545:
    X: Bit_0 -> Battery Low
    Bit_1 -> Docking supply
    Bit_2 -> External power supply on CP545
    Bit_3 -> External power supply on Docking
    Example: &P 025 00 069
*/
    if( String(line).startsWith('&P 025') ){
        const match = line.match(/^\&P\s+025\s+(?<status>\d+)\s+(?<volts>\d+)/);
        if( match ){
            tagResponse.type = 'RESPONSE-PSU';
            const volts = parseInt(match.groups['volts'])/10;
            const status = parseInt(match.groups['status']);
            tagResponse.batteryVolts = volts;
            tagResponse.batteryLow = status & 0x01;
            tagResponse.onDock = status & 0x02;
            tagResponse.externalPower = status & 0x04;
        }
    }

/*  Serial number request response
    Serial number + Device type + soft version (SN):
    <S>SN_NNNNN_TTTTT_VVVV<E>
    <S>SN_NNNNN_TTTTT_VVVV_DDDDD_WWWW<E>
    N = Serial number (0 – 65535)
    T = Device type (CP540, HL440, HL940)
    V = Software version (example: VA05)
    D = If a docking station is connected (CP540) -> Serial number of the docking
    W = If a docking station is connected (CP540) -> Software version of the docking
    Example: SN 04811 CP545 VB10
*/
    if( String(line).startsWith('SN ') ){
        const match = line.match(/^SN\s+(?<serial>\d+)\s+(?<model>\w+)\s+(?<firmware>\w+)/);
        var tagResponse = { type:false, line:line};
        if( match ){
            tagResponse.type = 'RESPONSE-SN';
            tagResponse.serialNumber = match.groups['serial'];
            tagResponse.model = match.groups['model'];
            tagResponse.firmware = match.groups['firmware'];
        }
    }

    if( tagResponse.type == false ){
        // Unkown packet type
        writeLog("Uknown packet type:" + line );
    }

    if (logLine ){
        writeLog( line );
    }
    mqttPublishTagResponse( tagResponse );
}

function mqttPublishTagResponse(tagResponse){
    var jsonString = JSON.stringify(tagResponse);
    mqttClient.publish("tag545/response",jsonString);
}

function writeLog(buff){
    console.log(buff);
}