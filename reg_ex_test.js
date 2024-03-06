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

var line = "SN 04811 CP545 VB10";

// const match = line.match(/^TN\s+(?<seq>\d+)\s+(?<channel>\w+)\s+(?<timestamp>[^\s]+)\s+(?<days>\d+)/);
// const match = line.match(/^VE\s+(?<snumber>\d+)\s+(?<candidate>\w+)\s+(?<speed>[^\s]+)\s+(?<unit>\w+)/);
// const match = line.match(/^\&P\s+025\s+(?<status>\d+)\s+(?<volts>\d+)/);
const match = line.match(/^SN\s+(?<serial>\d+)\s+(?<model>\w+)\s+(?<firmware>\w+)/);
console.log( match );
var tagResponse = { type:false, line:line};

if( match ){
    tagResponse.type = 'RESPONSE-SN';
    tagResponse.serialNumber = match.groups['serial'];
    tagResponse.model = match.groups['model'];
    tagResponse.firmware = match.groups['firmware'];
}


console.log( tagResponse );