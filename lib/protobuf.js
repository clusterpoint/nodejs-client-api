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

function bytesToVarint(data, offset) {
    var result = 0;
    var parsed = 0, shift = 0;
    for (; offset + parsed < data.length; parsed++) {
        result += (data[offset + parsed] & 0x7F) << shift;
        shift += 7;
        if ((data[offset + parsed] & 0x80) == 0)
            return [result, parsed + 1];
    }
    return [result, parsed];
}

function serializeString(fieldNumber, data) {
    var dataBuffer = new Buffer(data);
    var sizeBuffer = varintToBytes(dataBuffer.length);
    // 2 == Hardcoded Probuf wire type for length delimited string
    return Buffer.concat([new Buffer([(fieldNumber << 3) | 2]), sizeBuffer, dataBuffer], 1 + sizeBuffer.length + dataBuffer.length);
}

function parseString(data, offset) {
    offset = offset || 0;
    var result = {};
    while (offset < data.length) {
        var tmp = bytesToVarint(data, offset);
        var value = tmp[0], parsed = tmp[1];
        if (parsed == 0) return result;
        offset += parsed;
        var wireType = value & 0x07;
        var fieldNumber = value >> 3;
        if (wireType == 2) {
            tmp = bytesToVarint(data, offset);
            if (tmp[1] == 0) return result;
            result[fieldNumber] = data.toString('utf8', offset + tmp[1], offset + tmp[0] + tmp[1]);
            offset += tmp[0] + tmp[1];
        }
    }
    return result;
}

exports.serializeString = serializeString;

exports.parseString = parseString;