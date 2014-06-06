var ProtobufWireType_LengthDelimited = 2;

function varintToBytes(value) {
    var result = [];
    var byte = 0x00;
    while (value > 0) {
        // Copy first 7 bits
        byte = value & 0x7F;
        // Shift to process next bits
        value = value >> 7;
        // Set first bit to indicate more numbers are to follow
        if (value > 0) byte |= 0x80;
        // Add byte to result
        result.push(byte);
    }
    return new Buffer(result);
}

exports.serialize = function(fieldNumber, wireType, data) {
    var result = [];
    result.push((fieldNumber << 3) | wireType);
    if (wireType == ProtobufWireType_LengthDelimited) {
        return Buffer.concat([new Buffer(result), varintToBytes(data.length), new Buffer(data)]);
    } else {
        return Buffer.concat([new Buffer(result), new Buffer(data)]);
    }
}

exports.serializeString = function(fieldNumber, data) {
    return exports.serialize(fieldNumber, ProtobufWireType_LengthDelimited, data);
}